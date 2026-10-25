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
 * Toda linha, direta ou da fila, leva o horário em que a posição foi
 * CAPTURADA pelo GPS (`timestamp`), nunca o relógio do servidor (default
 * `NOW()` da coluna): o insert pode sair segundos ou horas depois do fix.
 *
 * - **Fila vazia:** insert direto de uma linha, como antes.
 * - **Falha de rede:** a posição vai para o AsyncStorage, com o horário dela.
 * - **Falha que não é de rede, com a fila vazia:** a posição não entra na
 *   fila (uma posição só, como antes desta fila). Fica o `logger.error`.
 * - **Fila com algo:** a posição nova entra no fim da fila e a fila inteira é
 *   enviada em lote, em ordem cronológica. A nova chega por último porque o
 *   marcador do gestor segue o último INSERT do realtime: enviar a fila depois
 *   da nova faria o motorista "voltar" no mapa.
 *
 * Cada posição guardada leva o `rota_id` com que foi capturada e é enviada com
 * ele. A posição de uma rota que não é mais do motorista (reatribuída, loja
 * desativada) é recusada pelo servidor. O lote é cortado por rota (sequências
 * consecutivas). Lote recusado:
 *
 * - **por rede:** fica, e o envio para até a próxima posição;
 * - **por DADO** (`CODIGOS_RECUSA_DE_DADO`: FK de rota apagada, NOT NULL,
 *   CHECK, tipo, número fora da faixa): descartado na hora, só o lote daquela
 *   rota;
 * - **por qualquer outra coisa** (rota que não é mais do motorista, JWT
 *   vencido, requisição saindo anônima porque o refresh do token falhou, 5xx
 *   sem texto de rede): fica, cada posição conta uma tentativa, e o envio
 *   SEGUE com os lotes das outras rotas — a rota recusada só volta a ser
 *   tentada na próxima posição. A que chega a `MAX_TENTATIVAS_POSICAO` sai,
 *   com um `logger.error` por descarte. Não é descartado na hora porque a
 *   resposta do servidor é a mesma nos dois casos, e é justamente na volta de
 *   um longo período sem rede que o token está vencido — descartar ali
 *   perderia a fila inteira, que é o que esta fila existe para guardar.
 *
 * - **Por conta.** A fila guarda o dono; fila de outra conta é descartada sem
 *   envio (o servidor recusaria, e não é posição desta sessão). Apagada no
 *   logout (`CHAVES_DA_CONTA` em `src/lib/auth/limparEstadoLocal.ts`).
 * - **Só com rastreamento ou sessão do motorista.** Nada entra na fila sem o
 *   contexto de rastreamento daquele `motorista_id` ou, na falta dele, a
 *   sessão dele confirmada (sem rede, o último usuário) — ver
 *   `aindaEhDoAparelho`. Fecha a corrida com o logout: a posição que
 *   estava no ar quando o motorista saiu falharia por rede depois da limpeza
 *   e recriaria a fila. Conferido dentro da fila em série, logo antes de
 *   gravar, para a janela ser a menor possível.
 * - **Teto de `TETO_FILA_POSICOES`.** Estourou: as mais antigas são espaçadas
 *   (`espacarFila`), não descartadas, com um `logger.warn` por estouro (não
 *   por posição), até a fila voltar a caber.
 * - **Sem React.** Roda na task headless do `expo-task-manager`; o gatilho do
 *   envio é a próxima posição, sem listener que vaze.
 * - **Voo único.** Duas posições quase juntas não enviam o mesmo lote duas
 *   vezes: o envio em andamento é compartilhado, e toda leitura-escrita do
 *   AsyncStorage passa por uma fila em série.
 *
 * LIMITES CONHECIDOS (aceitos para GPS: custam pontos repetidos ou uma
 * posição, nunca a fila):
 *
 * - **A garantia do voo único é por contexto JS.** `cadeia` e `envioEmVoo`
 *   vivem em memória. Com o app vivo (primeiro ou segundo plano), a task, o
 *   hook e a navegação rodam no MESMO contexto e ficam serializados. A task só
 *   roda num contexto headless separado quando o processo do app não está de
 *   pé; a sobreposição real é a janela em que o motorista reabre o app com o
 *   headless ainda enviando um lote. Risco baixo: no pior caso, uma posição
 *   sobrescrita no ler-modificar-gravar (perdida) ou o mesmo lote inserido
 *   duas vezes (o `remover` relê e filtra por identidade, então não perde).
 * - **Timeout com o insert já gravado.** Em sinal fraco, o lote pode chegar ao
 *   banco e a resposta não voltar: ele fica na fila e sobe de novo. A tabela
 *   não tem chave natural para deduplicar — o trajeto ganha pontos repetidos,
 *   não buracos.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { lerSessao } from '@/lib/auth/sessao';
import { lerUltimoUsuario } from '@/lib/auth/ultimoUsuario';
import { isNetworkError } from '@/lib/errorMapping';
import { logarFalha } from '@/lib/logarFalha';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { motoristaDoContexto } from './contextoRastreamento';

export const CHAVE_FILA_POSICOES = '@rotamestre:fila_posicoes';
export const TETO_FILA_POSICOES = 500;

/**
 * Tentativas de envio de uma posição guardada antes de desistir dela, quando
 * o banco recusa com um erro que não sabemos classificar (nem rede, nem
 * recusa de dado). Conta TENTATIVAS, não tempo: só há tentativa quando chega
 * uma posição nova (a cada 5–30 s com a rota andando), e motorista parado
 * não gasta nada. 60 tentativas cobrem de ~5 min (navegação, 5 s) a ~30 min
 * (só a task), tempo de sobra para o supabase-js renovar um token vencido ou
 * um gateway voltar de um 5xx. Um erro que nunca passa (rota que não é mais
 * do motorista) guarda aquele lote por no máximo 60 posições, e não atrasa o
 * envio das outras rotas.
 */
export const MAX_TENTATIVAS_POSICAO = 60;

/**
 * Códigos do Postgres de recusa determinística de DADO: reenviar a mesma
 * linha dá sempre o mesmo erro. 23503 (FK: rota apagada), 23502 (NOT NULL),
 * 23514 (CHECK), 22P02 (texto que não converte para o tipo), 22003 (número
 * fora da faixa da coluna). Só estes descartam o lote na hora; qualquer outro
 * erro (JWT vencido, RLS com a requisição saindo anônima, 5xx sem texto de
 * rede) pode ser passageiro.
 *
 * 22003: com `sanearPosicao` nenhuma medida passa do teto de `numeric(8,2)`,
 * então ele só volta se o banco tiver um tipo mais estreito que o esperado.
 * Fora desta lista, o lote da rota ficaria até `MAX_TENTATIVAS_POSICAO`
 * reenvios (de ~5 a ~30 min) e sairia do mesmo jeito, com o trajeto daquela
 * rota parado para o gestor nesse meio tempo.
 */
const CODIGOS_RECUSA_DE_DADO = new Set([
  '23503',
  '23502',
  '23514',
  '22P02',
  '22003',
]);

function ehRecusaDeDado(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return CODIGOS_RECUSA_DE_DADO.has(String(error.code));
}

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

/**
 * Maior valor que `velocidade`, `precisao` e `heading` aceitam no banco:
 * `numeric(8,2)` desde a Migration 60. Até ela eram `numeric(5,2)` (999,99), e
 * o `accuracy` de 1000 m+ que o GPS entrega logo ao abrir o app em ambiente
 * fechado era recusado com 22003 (medido no aparelho em 25/10/2026).
 */
export const TETO_MEDIDA_POSICAO = 999999.99;

function medida(valor: number | null, valida: (v: number) => boolean) {
  return valor !== null && Number.isFinite(valor) && valida(valor)
    ? valor
    : null;
}

const naFaixa = (v: number) => v >= 0 && v <= TETO_MEDIDA_POSICAO;

/**
 * As medidas do GPS no formato que o banco aceita: o que não é medida (não
 * finito, negativo — o iOS manda -1 para "inválido" —, `heading` fora de
 * [0, 360), acima de `TETO_MEDIDA_POSICAO`) vira null. A posição em si nunca é
 * descartada: latitude e longitude continuam valendo para o trajeto.
 *
 * Null, e não o teto: gravar 999999,99 numa precisão de 2.000 km, ou 359,99
 * num heading de 720, registraria uma medida que o GPS não fez; null é o que
 * a coluna já usa para "sem medida" (velocidade parada, heading sem bússola).
 */
export function sanearPosicao(posicao: Posicao): Posicao {
  return {
    ...posicao,
    velocidade: medida(posicao.velocidade, naFaixa),
    precisao: medida(posicao.precisao, naFaixa),
    heading: medida(posicao.heading, (v) => v >= 0 && v < 360),
  };
}

/** Linha da tabela para uma posição guardada: com o horário de captura. */
type LinhaGuardada = Posicao & { timestamp: string };

/**
 * Posição guardada: a linha e o controle da fila. `tentativas` (recusas que
 * não são de rede nem de dado) nunca vai ao banco — ver `paraLinha`.
 */
type PosicaoGuardada = LinhaGuardada & { tentativas?: number };

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

/**
 * Geração da fila: muda a cada logout e exclusão de conta
 * (`invalidarPosicoesEmVoo`).
 *
 * POR QUE EXISTE. Com sinal fraco, o insert de uma posição pode estar no ar
 * quando o logout limpa o aparelho e só falhar por rede depois. A limpeza
 * (`multiRemove` em `limparEstadoLocalDoUsuario`) não passa pela fila em
 * série, e conferir contexto ou último usuário antes de gravar deixa uma
 * janela assíncrona: o contexto de rastreamento sai no logout (o
 * `stopBackgroundTracking` o apaga antes da limpeza), mas uma posição pode
 * tê-lo lido antes disso. Cada operação guarda a geração em que começou;
 * o envio da fila também confere a cada rodada; `gravar` compara de
 * forma síncrona logo antes de emitir a escrita. Ou o logout já trocou a
 * geração (a escrita é descartada), ou a escrita sai antes do `multiRemove`,
 * que a apaga em seguida (o AsyncStorage executa na ordem).
 */
let geracao = 0;

/**
 * Descarta tudo o que está em voo na fila: nenhuma operação começada antes
 * desta chamada grava mais nada. Chamada pelo logout e pela exclusão de
 * conta (`limparEstadoLocal.ts`), de forma síncrona, ANTES de apagar o
 * armazenamento.
 */
export function invalidarPosicoesEmVoo(): void {
  geracao++;
}

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

/**
 * false = não gravou: a geração mudou desde `geracaoDeOrigem` (houve logout)
 * ou o AsyncStorage recusou.
 */
async function gravar(
  registro: Registro,
  geracaoDeOrigem: number,
): Promise<boolean> {
  // Síncrono até emitir a escrita: nada pode trocar a geração no meio.
  if (geracaoDeOrigem !== geracao) return false;
  try {
    if (registro.posicoes.length === 0) {
      await AsyncStorage.removeItem(CHAVE_FILA_POSICOES);
    } else {
      await AsyncStorage.setItem(CHAVE_FILA_POSICOES, JSON.stringify(registro));
    }
    return true;
  } catch (error) {
    logger.warn('[FilaPosicoes] Falha ao gravar a fila de posições', error);
    return false;
  }
}

/**
 * A linha da tabela com o horário do fix do GPS (`capturadaEm`, epoch ms) e as
 * medidas saneadas (`sanearPosicao`). Horário inválido (o `toISOString`
 * lançaria e a posição se perderia) cai no relógio do aparelho, que ainda é
 * mais perto da captura que o do servidor.
 *
 * É a porta das duas vias — o insert direto e a fila —, então uma medida fora
 * da faixa não chega nem ao banco nem ao AsyncStorage, onde envenenaria o
 * lote da rota a cada reenvio.
 */
function comHorario(posicao: Posicao, capturadaEm: number): LinhaGuardada {
  const horario = Number.isFinite(capturadaEm) ? capturadaEm : Date.now();
  return {
    ...sanearPosicao(posicao),
    timestamp: new Date(horario).toISOString(),
  };
}

/**
 * Ainda há rastreamento ou sessão de `motoristaId` neste aparelho, nesta
 * ordem:
 *
 * 1. **Contexto de rastreamento** daquele motorista: leitura local, e é ele
 *    que existe no caso comum do nativo (sem rede, com o token vencido, a
 *    sessão não se confirma).
 * 2. **Sessão confirmada** dele: cobre quem grava sem contexto (navegação,
 *    broadcast) — no web, sempre, porque lá o contexto nunca é gravado.
 * 3. **Sessão "offline"** só com o último usuário (`lerUltimoUsuario`) igual
 *    ao motorista. Sem rede, `lerSessao` nem lê a sessão; o último usuário é
 *    a prova local de dono, e o logout o apaga — então a posição em voo do
 *    logout não passa por aqui. Com rede e sem sessão (requisição anônima),
 *    ele não basta.
 *
 * Custo aceito: sem contexto, `lerSessao` roda dentro da fila em série e pode
 * segurá-la até `PRAZO_LEITURA_SESSAO_MS` com rede ruim. Conferir fora dela
 * alargaria a janela da corrida com o logout.
 */
async function aindaEhDoAparelho(motoristaId: string): Promise<boolean> {
  if ((await motoristaDoContexto()) === motoristaId) return true;
  const { session, offline } = await lerSessao();
  if (session) return session.user?.id === motoristaId;
  return offline && (await lerUltimoUsuario()) === motoristaId;
}

/**
 * Faz a fila caber em `teto` espaçando as posições, em vez de descartar as
 * mais antigas: enquanto passa do teto, tira a posição cuja saída abre o menor
 * buraco no tempo (o menor intervalo entre a anterior e a seguinte). O
 * resultado tende a um espaçamento uniforme no período inteiro sem rede, de
 * qualquer duração. Ficam sempre: a primeira e a última posição de cada rota
 * (o envio corta o lote por rota) e as `teto / 5` mais recentes, inteiras.
 *
 * POR QUE. Em segundo plano o app grava a cada 50 m: dirigindo, 500 posições
 * são ~40 min. Descartar as mais antigas apagava o começo de um período longo
 * sem sinal; aumentar o teto custaria regravar uma fila maior a cada posição
 * (o AsyncStorage guarda a fila num item só) e um envio enorme na volta do
 * sinal, que costuma ser fraco. Espaçar "uma a cada duas da metade mais
 * antiga" a cada estouro foi descartado: as horas mais antigas eram afinadas
 * de novo a cada vez e, num período longo, ficavam com uma posição só.
 *
 * Custo: uma varredura da fila por posição guardada com a fila cheia (500
 * itens), desprezível perto da regravação do AsyncStorage. Sem nada que possa
 * sair (só pontas de rota), cai no descarte das mais antigas, para a fila
 * nunca passar do teto.
 */
export function espacarFila<T extends { rota_id: string; timestamp: string }>(
  posicoes: T[],
  teto: number,
): T[] {
  const fila = [...posicoes];
  const recentesInteiras = Math.floor(teto / 5);
  const instante = (p: T) => Date.parse(p.timestamp);
  while (fila.length > teto) {
    let escolhida = -1;
    let menorBuraco = Infinity;
    const limite = fila.length - recentesInteiras - 1;
    for (let i = 1; i < limite; i++) {
      const p = fila[i];
      if (fila[i - 1].rota_id !== p.rota_id) continue;
      if (fila[i + 1].rota_id !== p.rota_id) continue;
      const buraco = instante(fila[i + 1]) - instante(fila[i - 1]);
      if (buraco < menorBuraco) {
        menorBuraco = buraco;
        escolhida = i;
      }
    }
    if (escolhida === -1) return fila.slice(fila.length - teto);
    fila.splice(escolhida, 1);
  }
  return fila;
}

/**
 * false = não ficou guardada (sem rastreamento nem sessão do motorista, ou o
 * AsyncStorage recusou a gravação).
 */
function guardar(
  linha: LinhaGuardada,
  geracaoDeOrigem: number,
): Promise<boolean> {
  return emSerie(async () => {
    if (!(await aindaEhDoAparelho(linha.motorista_id))) return false;
    const atual = await ler();
    const registro: Registro =
      atual?.userId === linha.motorista_id
        ? atual
        : { userId: linha.motorista_id, posicoes: [], estourou: false };

    registro.posicoes.push(linha);

    if (registro.posicoes.length > TETO_FILA_POSICOES) {
      registro.posicoes = espacarFila(registro.posicoes, TETO_FILA_POSICOES);
      if (!registro.estourou) {
        registro.estourou = true;
        logger.warn(
          '[FilaPosicoes] Fila de posições cheia: espaçando as mais antigas',
          { teto: TETO_FILA_POSICOES },
        );
      }
    }

    return gravar(registro, geracaoDeOrigem);
  });
}

/**
 * Descarta a fila se ela pertence a outra conta. Com a geração de quem pediu:
 * depois de um logout, a fila "de outra conta" pode ser a de quem acabou de
 * entrar, e não é este pedido antigo que a apaga.
 */
function descartarFilaDeOutraConta(
  motoristaId: string,
  geracaoDeOrigem: number,
): Promise<void> {
  return emSerie(async () => {
    const atual = await ler();
    if (atual && atual.userId !== motoristaId) {
      await gravar({ ...atual, posicoes: [] }, geracaoDeOrigem);
    }
  });
}

const chaveDa = (p: PosicaoGuardada) =>
  `${p.rota_id}|${p.timestamp}|${p.latitude}|${p.longitude}`;

/**
 * Tira da fila as posições do lote. Por identidade, não por posição na
 * lista: enquanto o lote estava no ar, o teto pode ter cortado o começo.
 */
function remover(
  motoristaId: string,
  lote: PosicaoGuardada[],
  geracaoDeOrigem: number,
): Promise<void> {
  return emSerie(async () => {
    const atual = await ler();
    if (!atual || atual.userId !== motoristaId) return;
    const saem = new Set(lote.map(chaveDa));
    const posicoes = atual.posicoes.filter((p) => !saem.has(chaveDa(p)));
    await gravar(
      {
        userId: atual.userId,
        posicoes,
        estourou: atual.estourou && posicoes.length >= TETO_FILA_POSICOES,
      },
      geracaoDeOrigem,
    );
  });
}

/**
 * Conta mais uma tentativa recusada para as posições do lote; as que chegam a
 * `MAX_TENTATIVAS_POSICAO` saem da fila, com um `logger.error` por descarte.
 */
function marcarTentativa(
  motoristaId: string,
  lote: PosicaoGuardada[],
  error: unknown,
  geracaoDeOrigem: number,
): Promise<void> {
  return emSerie(async () => {
    const atual = await ler();
    if (!atual || atual.userId !== motoristaId) return;
    const tentadas = new Set(lote.map(chaveDa));
    let esgotadas = 0;
    const posicoes: PosicaoGuardada[] = [];
    for (const p of atual.posicoes) {
      if (!tentadas.has(chaveDa(p))) {
        posicoes.push(p);
        continue;
      }
      const tentativas = (p.tentativas ?? 0) + 1;
      if (tentativas >= MAX_TENTATIVAS_POSICAO) {
        esgotadas++;
      } else {
        posicoes.push({ ...p, tentativas });
      }
    }
    if (esgotadas > 0) {
      logger.error(
        '[FilaPosicoes] Posições guardadas esgotaram as tentativas; descartadas',
        { rota_id: lote[0].rota_id, quantidade: esgotadas, error },
      );
    }
    await gravar(
      {
        userId: atual.userId,
        posicoes,
        estourou: atual.estourou && posicoes.length >= TETO_FILA_POSICOES,
      },
      geracaoDeOrigem,
    );
  });
}

/** A linha que vai ao banco: sem o controle da fila. */
function paraLinha({ tentativas: _tentativas, ...linha }: PosicaoGuardada) {
  return linha;
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

async function inserir(
  linhas: LinhaGuardada | LinhaGuardada[],
): Promise<{ error: unknown }> {
  try {
    const { error } = await supabase.from('motorista_locations').insert(linhas);
    return { error };
  } catch (error) {
    return { error };
  }
}

/**
 * Primeira sequência consecutiva de posições da mesma rota, pulando as rotas
 * já recusadas neste envio. Vazia = só sobraram rotas recusadas.
 */
function primeiroLote(
  posicoes: PosicaoGuardada[],
  recusadas: ReadonlySet<string>,
): PosicaoGuardada[] {
  const restantes = posicoes.filter((p) => !recusadas.has(p.rota_id));
  if (restantes.length === 0) return [];
  const rota = restantes[0].rota_id;
  const fim = restantes.findIndex((p) => p.rota_id !== rota);
  return fim === -1 ? restantes : restantes.slice(0, fim);
}

/** true = a fila esvaziou; false = sobrou algo (sem rede ou lote recusado). */
async function enviarFila(
  motoristaId: string,
  rotulo: string,
): Promise<boolean> {
  const geracaoDoEnvio = geracao;
  // Rotas cujo lote o servidor recusou neste envio: ficam para o próximo.
  const recusadas = new Set<string>();
  // Um logout no meio do envio troca a geração: este envio é da conta que
  // saiu e não segue. Sem isto, a rodada seguinte leria a fila de quem
  // entrou e a apagaria como "de outra conta" (N1), ou, com a mesma conta de
  // volta, reenviaria o lote cujo `remover` a geração recusou — até
  // `MAX_RODADAS` vezes (N2). Conferido antes e depois de ler: a leitura
  // também espera.
  const trocouDeConta = () => geracaoDoEnvio !== geracao;
  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    if (trocouDeConta()) return false;
    const fila = await emSerie(ler);
    if (trocouDeConta()) return false;
    if (!fila || fila.posicoes.length === 0) return true;
    if (fila.userId !== motoristaId) {
      await descartarFilaDeOutraConta(motoristaId, geracaoDoEnvio);
      return true;
    }

    const lote = primeiroLote(fila.posicoes, recusadas);
    if (lote.length === 0) return false;
    const { error } = await inserir(lote.map(paraLinha));
    if (error && isNetworkError(error)) {
      // Sem rede, nenhum outro lote subiria: para e tenta na próxima posição.
      logarFalha(rotulo, error);
      return false;
    }
    if (error && !ehRecusaDeDado(error)) {
      // Posição recusada pelo servidor: rota que não é mais do motorista, ou
      // algo passageiro (token vencido, 5xx) — a resposta é a mesma e não dá
      // para separar. O lote fica e conta uma tentativa (até
      // `MAX_TENTATIVAS_POSICAO`), e o envio segue com as outras rotas.
      logarFalha(rotulo, error);
      await marcarTentativa(motoristaId, lote, error, geracaoDoEnvio);
      recusadas.add(lote[0].rota_id);
      continue;
    }
    if (error) {
      // Recusa de dado (ex.: rota apagada): reenviar falharia para sempre.
      logger.error(
        '[FilaPosicoes] Banco recusou posições guardadas; descartadas',
        {
          rota_id: lote[0].rota_id,
          quantidade: lote.length,
          error,
        },
      );
    }
    await remover(motoristaId, lote, geracaoDoEnvio);
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
  // Antes de qualquer espera: o logout no meio do insert invalida esta.
  const geracaoDaPosicao = geracao;
  try {
    const linha = comHorario(posicao, capturadaEm);
    const fila = await emSerie(ler);
    const temFila =
      fila?.userId === posicao.motorista_id && fila.posicoes.length > 0;

    if (!temFila && !envioEmVoo) {
      if (fila) {
        await descartarFilaDeOutraConta(posicao.motorista_id, geracaoDaPosicao);
      }
      const { error } = await inserir(linha);
      if (!error) return 'enviada';
      logarFalha(rotulo, error);
      if (!isNetworkError(error)) return 'perdida';
      return (await guardar(linha, geracaoDaPosicao)) ? 'na_fila' : 'perdida';
    }

    // Sem gravar a nova, não envia a fila: com o AsyncStorage recusando, a
    // remoção do lote também falharia e o mesmo lote subiria de novo.
    if (!(await guardar(linha, geracaoDaPosicao))) return 'perdida';
    const esvaziou = await esvaziarFila(posicao.motorista_id, rotulo);
    return esvaziou ? 'enviada' : 'na_fila';
  } catch (error) {
    logarFalha(rotulo, error);
    return 'perdida';
  }
}
