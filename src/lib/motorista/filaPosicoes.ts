/**
 * Fila das posições de GPS do motorista que não subiram por falta de rede.
 *
 * POR QUE EXISTE. Os três pontos que gravam em `motorista_locations` (a task
 * de segundo plano em `unifiedLocationTracking`, o modo navegação em
 * `locationTracking` e o hook `useDriverLocationBroadcast`) só registravam o
 * erro quando o insert falhava: as posições de um túnel ou de uma zona sem
 * sinal se perdiam e o trajeto que o gestor vê ficava com buracos.
 *
 * COMO FUNCIONA. `registrarPosicao` é a porta única do insert:
 *
 * - **Fila vazia:** insert direto de uma linha, como antes. O horário fica com
 *   o relógio do servidor (default `NOW()` da coluna `timestamp`).
 * - **Falha de rede:** a posição vai para o AsyncStorage com o horário em que
 *   foi CAPTURADA (`timestamp`), que é a única verdade para uma posição velha.
 * - **Falha que não é de rede** (RLS, FK de rota apagada): não entra na fila —
 *   reenviar daria o mesmo erro para sempre. Fica o `logger.error`.
 * - **Fila com algo:** a posição nova entra no fim da fila e a fila inteira é
 *   enviada em lote, em ordem cronológica. A nova chega por último porque o
 *   marcador do gestor segue o último INSERT do realtime: enviar a fila depois
 *   da nova faria o motorista "voltar" no mapa.
 *
 * Cada posição guardada leva o `rota_id` com que foi capturada e é enviada com
 * ele — são posições verdadeiras daquela rota, mesmo que ela já tenha sido
 * finalizada ou trocada. O lote é cortado por rota (sequências consecutivas):
 * se uma rota foi apagada, só o lote dela é recusado e descartado.
 *
 * - **Por conta.** A fila guarda o dono; fila de outra conta é descartada sem
 *   envio (a RLS recusaria, e não é posição desta sessão). Apagada no logout
 *   (`CHAVES_DA_CONTA` em `src/lib/auth/limparEstadoLocal.ts`).
 * - **Teto de `TETO_FILA_POSICOES`.** Estourou: saem as mais antigas, com um
 *   `logger.warn` por estouro (não por posição), até a fila voltar a caber.
 * - **Sem React.** Roda na task headless do `expo-task-manager`; o gatilho do
 *   envio é a próxima posição, sem listener que vaze.
 * - **Voo único.** Duas posições quase juntas não enviam o mesmo lote duas
 *   vezes: o envio em andamento é compartilhado, e toda leitura-escrita do
 *   AsyncStorage passa por uma fila em série.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isNetworkError } from '@/lib/errorMapping';
import { logarFalha } from '@/lib/logarFalha';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export const CHAVE_FILA_POSICOES = '@rotamestre:fila_posicoes';
export const TETO_FILA_POSICOES = 500;

/**
 * Rodadas de envio por voo. Cada rodada envia uma sequência de uma rota só;
 * o limite impede laço sem fim se o AsyncStorage não conseguir gravar a
 * remoção (o lote seria reenviado a cada volta).
 */
const MAX_RODADAS = 20;

/** Linha de `motorista_locations` como o cliente a envia. */
export interface Posicao {
  motorista_id: string;
  rota_id: string;
  latitude: number;
  longitude: number;
  velocidade: number | null;
  precisao: number | null;
  heading: number | null;
  fonte?: 'foreground' | 'background';
}

/** Posição guardada: a mesma linha, com o horário de captura. */
type PosicaoGuardada = Posicao & { timestamp: string };

interface Registro {
  userId: string;
  posicoes: PosicaoGuardada[];
  /** Já avisou deste estouro do teto; volta a false quando a fila cabe. */
  estourou: boolean;
}

/** Onde a posição foi parar: no banco, na fila do aparelho, ou em lugar nenhum. */
export type DestinoDaPosicao = 'enviada' | 'na_fila' | 'perdida';

// ---------------------------------------------------------------------------
// Armazenamento (sempre em série)
// ---------------------------------------------------------------------------

let cadeia: Promise<unknown> = Promise.resolve();

/** Executa `fn` depois de toda leitura-escrita anterior da fila. */
function emSerie<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = cadeia.then(fn, fn);
  cadeia = resultado.catch(() => undefined);
  return resultado;
}

async function ler(): Promise<Registro | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_FILA_POSICOES);
    return bruto ? (JSON.parse(bruto) as Registro) : null;
  } catch (error) {
    logger.warn('[FilaPosicoes] Falha ao ler a fila de posições', error);
    return null;
  }
}

async function gravar(registro: Registro): Promise<void> {
  try {
    if (registro.posicoes.length === 0) {
      await AsyncStorage.removeItem(CHAVE_FILA_POSICOES);
    } else {
      await AsyncStorage.setItem(CHAVE_FILA_POSICOES, JSON.stringify(registro));
    }
  } catch (error) {
    logger.warn('[FilaPosicoes] Falha ao gravar a fila de posições', error);
  }
}

function guardar(posicao: Posicao, capturadaEm: number): Promise<void> {
  return emSerie(async () => {
    const atual = await ler();
    const registro: Registro =
      atual?.userId === posicao.motorista_id
        ? atual
        : { userId: posicao.motorista_id, posicoes: [], estourou: false };

    registro.posicoes.push({
      ...posicao,
      timestamp: new Date(capturadaEm).toISOString(),
    });

    const excesso = registro.posicoes.length - TETO_FILA_POSICOES;
    if (excesso > 0) {
      registro.posicoes.splice(0, excesso);
      if (!registro.estourou) {
        registro.estourou = true;
        logger.warn(
          '[FilaPosicoes] Fila de posições cheia: descartando as mais antigas',
          { teto: TETO_FILA_POSICOES },
        );
      }
    }

    await gravar(registro);
  });
}

/** Descarta a fila se ela pertence a outra conta. */
function descartarFilaDeOutraConta(motoristaId: string): Promise<void> {
  return emSerie(async () => {
    const atual = await ler();
    if (atual && atual.userId !== motoristaId) {
      await gravar({ ...atual, posicoes: [] });
    }
  });
}

const chaveDa = (p: PosicaoGuardada) =>
  `${p.rota_id}|${p.timestamp}|${p.latitude}|${p.longitude}`;

/**
 * Tira da fila as posições do lote. Por identidade, não por posição na
 * lista: enquanto o lote estava no ar, o teto pode ter cortado o começo.
 */
function remover(motoristaId: string, lote: PosicaoGuardada[]): Promise<void> {
  return emSerie(async () => {
    const atual = await ler();
    if (!atual || atual.userId !== motoristaId) return;
    const saem = new Set(lote.map(chaveDa));
    const posicoes = atual.posicoes.filter((p) => !saem.has(chaveDa(p)));
    await gravar({
      userId: atual.userId,
      posicoes,
      estourou: atual.estourou && posicoes.length >= TETO_FILA_POSICOES,
    });
  });
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

async function inserir(
  linhas: Posicao | PosicaoGuardada[],
): Promise<{ error: unknown }> {
  try {
    const { error } = await supabase.from('motorista_locations').insert(linhas);
    return { error };
  } catch (error) {
    return { error };
  }
}

/** Primeira sequência consecutiva de posições da mesma rota. */
function primeiroLote(posicoes: PosicaoGuardada[]): PosicaoGuardada[] {
  const rota = posicoes[0].rota_id;
  const fim = posicoes.findIndex((p) => p.rota_id !== rota);
  return fim === -1 ? posicoes : posicoes.slice(0, fim);
}

/** true = a fila esvaziou; false = parou por falta de rede. */
async function enviarFila(
  motoristaId: string,
  rotulo: string,
): Promise<boolean> {
  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    const fila = await emSerie(ler);
    if (!fila || fila.posicoes.length === 0) return true;
    if (fila.userId !== motoristaId) {
      await descartarFilaDeOutraConta(motoristaId);
      return true;
    }

    const lote = primeiroLote(fila.posicoes);
    const { error } = await inserir(lote);
    if (error && isNetworkError(error)) {
      logarFalha(rotulo, error);
      return false;
    }
    if (error) {
      // Recusa definitiva (ex.: rota apagada): reenviar falharia para sempre.
      logger.error(
        '[FilaPosicoes] Banco recusou posições guardadas; descartadas',
        {
          rota_id: lote[0].rota_id,
          quantidade: lote.length,
          error,
        },
      );
    }
    await remover(motoristaId, lote);
  }
  return false;
}

let envioEmVoo: { userId: string; promessa: Promise<boolean> } | null = null;

/** Envia a fila de `motoristaId`; quem chega durante um envio pega carona nele. */
async function esvaziarFila(
  motoristaId: string,
  rotulo: string,
): Promise<boolean> {
  const atual = envioEmVoo;
  if (atual?.userId === motoristaId) return atual.promessa;
  if (atual) await atual.promessa;

  const promessa = enviarFila(motoristaId, rotulo).finally(() => {
    if (envioEmVoo?.promessa === promessa) envioEmVoo = null;
  });
  envioEmVoo = { userId: motoristaId, promessa };
  return promessa;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Grava uma posição em `motorista_locations`, guardando no aparelho se faltar
 * rede. `capturadaEm` é o epoch (ms) do fix do GPS; `rotulo` é a mensagem de
 * log de quem chama (falha de rede vira warn; o resto, error).
 */
export async function registrarPosicao(
  posicao: Posicao,
  capturadaEm: number,
  rotulo: string,
): Promise<DestinoDaPosicao> {
  try {
    const fila = await emSerie(ler);
    const temFila =
      fila?.userId === posicao.motorista_id && fila.posicoes.length > 0;

    if (!temFila && !envioEmVoo) {
      if (fila) await descartarFilaDeOutraConta(posicao.motorista_id);
      const { error } = await inserir(posicao);
      if (!error) return 'enviada';
      logarFalha(rotulo, error);
      if (!isNetworkError(error)) return 'perdida';
      await guardar(posicao, capturadaEm);
      return 'na_fila';
    }

    await guardar(posicao, capturadaEm);
    const esvaziou = await esvaziarFila(posicao.motorista_id, rotulo);
    return esvaziou ? 'enviada' : 'na_fila';
  } catch (error) {
    logarFalha(rotulo, error);
    return 'perdida';
  }
}
