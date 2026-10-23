/**
 * Fila de ações de parada (concluir / pular) feitas sem rede.
 *
 * POR QUE EXISTE. Sem sinal, `completeStop`/`skipStop` falhavam com erro e a
 * entrega não ficava registrada em lugar nenhum — o motorista, no meio da
 * rua, tinha de lembrar de refazer depois. A foto já tinha fila própria
 * (`src/lib/offline.ts`); a conclusão, não.
 *
 * POR QUE UM MÓDULO PRÓPRIO, e não a `addToOfflineQueue` genérica de
 * `offline.ts`: aquela fila espalha um UPDATE cego (`update_parada`) que
 * reenviado regride status e não sabe distinguir "parada removida" de "rede
 * caiu" — reenfileira para sempre. Aqui cada ação sabe o que quer dizer:
 *
 * - **Idempotente no servidor.** O UPDATE só muda parada ainda ABERTA
 *   (`pendente`/`em_andamento`). Reenviar não duplica log (o gatilho
 *   `log_parada_status` só dispara com linha alterada) nem regride uma
 *   conclusão feita por outro caminho — vira "já resolvida", não erro.
 * - **Conflito vira aviso, não loop.** Parada apagada, rota passada a outro
 *   motorista (a RLS esconde a linha) ou rota encerrada: a ação sai da fila e
 *   fica um aviso para a Início mostrar.
 * - **Por usuário.** A ação guarda o `motoristaId` da rota; só é enviada com a
 *   sessão dessa pessoa, para nunca registrar entrega em nome de outra.
 * - **Ordem preservada.** Envio em ordem de criação; falha de rede para o
 *   lote (o resto espera a próxima vez). A foto é enviada ANTES, no mesmo
 *   ciclo de sincronização (`setupOfflineSync`): a conclusão não referencia o
 *   arquivo — `foto_url` é ligada pelo próprio upload — então a ordem garante
 *   que o comprovante sobe primeiro, sem que um upload preso bloqueie a
 *   entrega para sempre.
 *
 * O acesso ao banco entra por uma porta (`PortaParadas`): os testes usam um
 * banco em memória com as mesmas regras, e o app usa `portaParadasSupabase`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MotivoSkip } from '@/constants/skipReasons';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const CHAVE_FILA = '@rotamestre:fila_acoes_parada';
const CHAVE_DESCARTES = '@rotamestre:fila_acoes_parada_descartes';

/** Erros definitivos (não de rede) tolerados antes de desistir da ação. */
export const MAX_TENTATIVAS = 5;

const STATUS_ABERTOS = ['pendente', 'em_andamento'];
const STATUS_RESOLVIDOS = ['concluida', 'pulada'];

export type TipoAcaoParada = 'concluir' | 'pular';

/** Frase única para "ficou guardado no aparelho" (sucesso de concluir/pular). */
export const AVISO_ENVIO_PENDENTE =
  'Sem internet: ficou salvo no aparelho e será enviado quando o sinal voltar.';

/** Onde a ação foi parar: no banco agora, ou na fila do aparelho. */
export type DestinoDaAcao = 'enviada' | 'na_fila';

export interface AcaoParada {
  id: string;
  tipo: TipoAcaoParada;
  paradaId: string;
  rotaId: string;
  /** Dono da rota no momento da ação; só a sessão dele envia. */
  motoristaId: string;
  /** Momento da ação no aparelho (vira `concluida_em`). */
  em: string;
  motivo?: MotivoSkip;
  observacoes?: string;
  /** Falhas definitivas do servidor já sofridas (rede não conta). */
  tentativas: number;
}

export type MotivoDescarte =
  | 'parada_removida'
  | 'rota_encerrada'
  /** O banco já tem outra decisão (ex.: concluída offline, pulada por outro caminho). */
  | 'status_divergente'
  | 'falha_persistente';

export interface DescarteDeAcao {
  acao: AcaoParada;
  motivo: MotivoDescarte;
  em: string;
}

export type ResultadoAplicacao =
  | { tipo: 'aplicada' }
  | { tipo: 'ja_resolvida'; status: string }
  | {
      tipo: 'descartada';
      motivo: Exclude<MotivoDescarte, 'falha_persistente'>;
    };

export interface ParadaLida {
  status: string;
  rota_id: string;
  rota: { status: string; motorista_id: string | null } | null;
}

export interface PortaParadas {
  /** null = não existe OU a RLS esconde (rota de outro motorista). Lança em erro. */
  lerParada(paradaId: string): Promise<ParadaLida | null>;
  /** UPDATE só se a parada ainda estiver aberta. true = uma linha mudou. */
  atualizarSeAberta(
    paradaId: string,
    dados: Record<string, unknown>,
  ): Promise<boolean>;
  /** Marca a próxima parada pendente como em andamento, se não houver outra. */
  avancarProxima(rotaId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Persistência (serializada: toda leitura-modificação-escrita passa por aqui)
// ---------------------------------------------------------------------------

let cadeia: Promise<unknown> = Promise.resolve();

function emSerie<T>(fn: () => Promise<T>): Promise<T> {
  const proxima = cadeia.then(fn, fn);
  cadeia = proxima.catch(() => undefined);
  return proxima;
}

async function lerLista<T>(chave: string): Promise<T[]> {
  try {
    const bruto = await AsyncStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T[]) : [];
  } catch (error) {
    logger.warn('[FilaParada] Falha ao ler a fila', error);
    return [];
  }
}

async function gravarLista<T>(chave: string, lista: T[]): Promise<void> {
  await AsyncStorage.setItem(chave, JSON.stringify(lista));
}

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

/** Avisa quem mostra "envio pendente" que a fila mudou. */
export function ouvirFilaAcoesParada(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function avisarOuvintes() {
  ouvintes.forEach((o) => {
    try {
      o();
    } catch (error) {
      logger.warn('[FilaParada] Ouvinte falhou', error);
    }
  });
}

export function criarAcaoParada(
  dados: Omit<AcaoParada, 'id' | 'tentativas'>,
): AcaoParada {
  return {
    ...dados,
    id: `acao_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    tentativas: 0,
  };
}

export function lerFilaAcoesParada(): Promise<AcaoParada[]> {
  return lerLista<AcaoParada>(CHAVE_FILA);
}

export async function enfileirarAcaoParada(acao: AcaoParada): Promise<void> {
  await emSerie(async () => {
    const fila = await lerLista<AcaoParada>(CHAVE_FILA);
    // A primeira decisão sobre a parada vale: a tela já a mostra resolvida.
    if (fila.some((a) => a.paradaId === acao.paradaId)) return;
    fila.push(acao);
    await gravarLista(CHAVE_FILA, fila);
  });
  avisarOuvintes();
}

export async function lerDescartesDaFila(
  motoristaId: string,
): Promise<DescarteDeAcao[]> {
  const todos = await lerLista<DescarteDeAcao>(CHAVE_DESCARTES);
  return todos.filter((d) => d.acao.motoristaId === motoristaId);
}

export async function dispensarDescartes(motoristaId: string): Promise<void> {
  await emSerie(async () => {
    const todos = await lerLista<DescarteDeAcao>(CHAVE_DESCARTES);
    await gravarLista(
      CHAVE_DESCARTES,
      todos.filter((d) => d.acao.motoristaId !== motoristaId),
    );
  });
  avisarOuvintes();
}

/**
 * O que a tela mostra enquanto a ação não subiu: a parada aparece resolvida
 * (o motorista segue para a próxima) e entra em `pendentes`, para o selo de
 * "envio pendente". Se o banco já resolveu a parada, o status dele vale.
 * Sem ação desta rota, devolve o MESMO array (não dispara re-render).
 */
export function sobreporAcoesPendentes<
  T extends { id: string; status: string },
>(
  paradas: T[],
  fila: AcaoParada[],
  rotaId: string | null | undefined,
): { paradas: T[]; pendentes: Set<string> } {
  const daRota = new Map(
    fila.filter((a) => a.rotaId === rotaId).map((a) => [a.paradaId, a]),
  );
  if (daRota.size === 0) return { paradas, pendentes: new Set() };

  const pendentes = new Set<string>();
  const sobrepostas = paradas.map((p) => {
    const acao = daRota.get(p.id);
    if (!acao || STATUS_RESOLVIDOS.includes(p.status)) return p;
    pendentes.add(p.id);
    return {
      ...p,
      status: acao.tipo === 'concluir' ? 'concluida' : 'pulada',
      ...(acao.tipo === 'concluir' ? { concluida_em: acao.em } : {}),
    };
  });
  return { paradas: sobrepostas, pendentes };
}

// ---------------------------------------------------------------------------
// Classificação de erro
// ---------------------------------------------------------------------------

/**
 * Sessão vencida ou ausente (JWT expirado, 401). Não é recusa da ação: ela
 * espera a sessão renovar, sem contar tentativa.
 */
export function ehErroDeSessao(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const e = erro as { code?: string; status?: number; message?: string };
  if (e.code === 'PGRST301' || e.code === 'PGRST303') return true;
  if (e.status === 401) return true;
  return /jwt|token is expired|not authenticated/i.test(e.message ?? '');
}

/**
 * Recusa DEFINITIVA do servidor — a única que conta tentativa (e, no limite,
 * descarta a ação). Allowlist: código de Postgres (SQLSTATE, 5 caracteres)
 * ou do PostgREST (`PGRST…`) que não seja de sessão, ou status 4xx que não
 * seja 401/408/429. Todo o resto — 5xx (502/503/504 chegam sem `code`, às
 * vezes com HTML no lugar do JSON), 408, 429, erro sem código — é "o servidor
 * não respondeu direito": a ação espera, sem contar.
 *
 * POR QUE ALLOWLIST DE DEFINITIVOS, e não uma lista de transitórios: errar
 * para o lado da allowlist deixa uma ação esperando (visível como pendente,
 * reenviada a cada gatilho); errar para o outro lado descarta uma entrega
 * numa queda de poucos minutos do servidor. O primeiro erro é recuperável.
 */
export function ehErroDefinitivo(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  if (ehErroDeSessao(erro)) return false;
  const e = erro as { code?: string; status?: number };
  if (typeof e.code === 'string' && /^PGRST\d+$/.test(e.code)) return true;
  // SQLSTATE: as classes 08 (conexão), 40 (deadlock/serialização), 53
  // (recurso esgotado), 57 (consulta cancelada/servidor caindo) e 58 (erro
  // de sistema) passam sozinhas — esperam, sem contar tentativa.
  if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) {
    return !/^(08|40|53|57|58)/.test(e.code);
  }
  if (
    typeof e.status === 'number' &&
    e.status >= 400 &&
    e.status < 500 &&
    ![401, 408, 429].includes(e.status)
  ) {
    return true;
  }
  return false;
}

/**
 * A requisição não chegou (ou a resposta não voltou): sem rede, rede que não
 * responde (timeout do `fetchComTimeout`, `AbortError`) ou `fetch` recusado.
 * Erro com código do Postgres/PostgREST é resposta do servidor — não é isto.
 * Timeout com o servidor tendo gravado é seguro: o reenvio é idempotente.
 */
export function ehFalhaDeEnvio(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const e = erro as { name?: string; message?: string; code?: string };
  if (e.code && e.code !== 'ABORT_ERR') return false;
  if (e.name === 'AbortError') return true;
  return /network|failed to fetch|fetch failed|timeout|timed out|aborted|offline/i.test(
    e.message ?? '',
  );
}

// ---------------------------------------------------------------------------
// Aplicação de uma ação
// ---------------------------------------------------------------------------

function dadosDaAcao(acao: AcaoParada): Record<string, unknown> {
  if (acao.tipo === 'concluir') {
    return { status: 'concluida', concluida_em: acao.em };
  }
  return {
    status: 'pulada',
    motivo_skip: acao.motivo ?? 'outro',
    ...(acao.observacoes ? { observacoes: acao.observacoes } : {}),
  };
}

function classificar(
  acao: AcaoParada,
  parada: ParadaLida | null,
): ResultadoAplicacao | null {
  if (!parada || parada.rota_id !== acao.rotaId) {
    return { tipo: 'descartada', motivo: 'parada_removida' };
  }
  if (!parada.rota || parada.rota.motorista_id !== acao.motoristaId) {
    return { tipo: 'descartada', motivo: 'parada_removida' };
  }
  if (STATUS_RESOLVIDOS.includes(parada.status)) {
    // Mesma decisão já no banco: reenvio idempotente. Outra decisão: o
    // motorista precisa saber que a dele não valeu.
    return parada.status === statusPretendido(acao)
      ? { tipo: 'ja_resolvida', status: parada.status }
      : { tipo: 'descartada', motivo: 'status_divergente' };
  }
  if (parada.rota.status !== 'em_andamento') {
    return { tipo: 'descartada', motivo: 'rota_encerrada' };
  }
  if (!STATUS_ABERTOS.includes(parada.status)) {
    return { tipo: 'descartada', motivo: 'status_divergente' };
  }
  return null;
}

function statusPretendido(acao: AcaoParada): string {
  return acao.tipo === 'concluir' ? 'concluida' : 'pulada';
}

/**
 * Aplica uma ação no banco. Lança só quando não houve resposta definitiva
 * (rede, erro do servidor); conflito é resultado, não exceção.
 */
export async function aplicarAcaoParada(
  acao: AcaoParada,
  porta: PortaParadas = portaParadasSupabase,
): Promise<ResultadoAplicacao> {
  const antes = classificar(acao, await porta.lerParada(acao.paradaId));
  if (antes) return antes;

  const mudou = await porta.atualizarSeAberta(acao.paradaId, dadosDaAcao(acao));
  if (mudou) return { tipo: 'aplicada' };

  // Alguém resolveu a parada entre a leitura e o UPDATE.
  const depois = classificar(acao, await porta.lerParada(acao.paradaId));
  // Ainda aberta e o UPDATE não mudou nada: sem explicação, não conta como
  // enviada em silêncio.
  return depois ?? { tipo: 'descartada', motivo: 'status_divergente' };
}

// ---------------------------------------------------------------------------
// Processamento da fila
// ---------------------------------------------------------------------------

let processando = false;
/** Pedido que chegou durante uma rodada: roda de novo ao terminar. */
let rodarDeNovo = false;

export interface ResultadoProcessamento {
  enviadas: number;
  descartadas: DescarteDeAcao[];
  restantes: number;
}

async function removerDaFila(id: string): Promise<void> {
  await emSerie(async () => {
    const fila = await lerLista<AcaoParada>(CHAVE_FILA);
    await gravarLista(
      CHAVE_FILA,
      fila.filter((a) => a.id !== id),
    );
  });
}

async function contarTentativa(id: string): Promise<number> {
  return emSerie(async () => {
    const fila = await lerLista<AcaoParada>(CHAVE_FILA);
    let tentativas = 0;
    const nova = fila.map((a) => {
      if (a.id !== id) return a;
      tentativas = a.tentativas + 1;
      return { ...a, tentativas };
    });
    await gravarLista(CHAVE_FILA, nova);
    return tentativas;
  });
}

async function registrarDescarte(descarte: DescarteDeAcao): Promise<void> {
  await emSerie(async () => {
    const todos = await lerLista<DescarteDeAcao>(CHAVE_DESCARTES);
    todos.push(descarte);
    await gravarLista(CHAVE_DESCARTES, todos);
  });
}

async function descartar(
  acao: AcaoParada,
  motivo: MotivoDescarte,
  lista: DescarteDeAcao[],
) {
  const descarte = { acao, motivo, em: new Date().toISOString() };
  await registrarDescarte(descarte);
  await removerDaFila(acao.id);
  lista.push(descarte);
}

export async function processarFilaAcoesParada({
  usuarioAtual,
  porta = portaParadasSupabase,
}: {
  usuarioAtual: string;
  porta?: PortaParadas;
}): Promise<ResultadoProcessamento> {
  if (processando) {
    rodarDeNovo = true;
    return { enviadas: 0, descartadas: [], restantes: 0 };
  }
  processando = true;

  const descartadas: DescarteDeAcao[] = [];
  const rotasAlteradas = new Set<string>();
  let enviadas = 0;

  /** Envia em ordem; true = parou esperando rede/sessão (o resto espera). */
  const enviarLote = async (acoes: AcaoParada[]): Promise<boolean> => {
    for (const acao of acoes) {
      try {
        const r = await aplicarAcaoParada(acao, porta);
        if (r.tipo === 'descartada') {
          await descartar(acao, r.motivo, descartadas);
          continue;
        }
        await removerDaFila(acao.id);
        enviadas++;
        if (r.tipo === 'aplicada') rotasAlteradas.add(acao.rotaId);
      } catch (error) {
        // Rede, sessão, 5xx/408/429 ou erro sem código: não é recusa da
        // ação. Só a recusa definitiva conta tentativa (ehErroDefinitivo).
        if (!ehErroDefinitivo(error)) return true;
        logger.warn('[FilaParada] Servidor recusou a ação', error);
        const tentativas = await contarTentativa(acao.id);
        if (tentativas >= MAX_TENTATIVAS) {
          await descartar(acao, 'falha_persistente', descartadas);
        }
      }
    }
    return false;
  };

  try {
    let esperarRede = false;
    do {
      rodarDeNovo = false;
      const minhas = (await lerFilaAcoesParada()).filter(
        (a) => a.motoristaId === usuarioAtual,
      );
      esperarRede = await enviarLote(minhas);
    } while (rodarDeNovo && !esperarRede);

    for (const rotaId of rotasAlteradas) {
      try {
        await porta.avancarProxima(rotaId);
      } catch (error) {
        // Não crítico: a próxima conclusão (ou a carga da rota) corrige.
        logger.warn('[FilaParada] Falha ao avançar a próxima parada', error);
      }
    }

    const restantes = (await lerFilaAcoesParada()).filter(
      (a) => a.motoristaId === usuarioAtual,
    ).length;
    return { enviadas, descartadas, restantes };
  } finally {
    processando = false;
    avisarOuvintes();
  }
}

/**
 * Envia a fila com a sessão atual — chamado por `setupOfflineSync` na volta
 * da rede, DEPOIS das fotos. Sem ação guardada, nem consulta a sessão; sem
 * sessão, espera (enviar sem dono cairia na RLS).
 */
export async function sincronizarFilaAcoesParada(): Promise<ResultadoProcessamento> {
  const vazio = { enviadas: 0, descartadas: [], restantes: 0 };
  if ((await lerFilaAcoesParada()).length === 0) return vazio;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const usuarioAtual = session?.user?.id;
    if (!usuarioAtual) return vazio;
    return await processarFilaAcoesParada({ usuarioAtual });
  } catch (error) {
    logger.warn('[FilaParada] Falha ao sincronizar a fila', error);
    return vazio;
  }
}

// ---------------------------------------------------------------------------
// Porta real (Supabase)
// ---------------------------------------------------------------------------

type ParadaComRota = {
  status: string;
  rota_id: string;
  rotas:
    | { status: string; motorista_id: string | null }
    | { status: string; motorista_id: string | null }[]
    | null;
};

export const portaParadasSupabase: PortaParadas = {
  async lerParada(paradaId) {
    const { data, error } = await supabase
      .from('paradas')
      .select('status, rota_id, rotas(status, motorista_id)')
      .eq('id', paradaId)
      // A relação embutida vem como objeto ou array conforme a inferência.
      .returns<ParadaComRota[]>()
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const rota = Array.isArray(data.rotas) ? data.rotas[0] : data.rotas;
    return { status: data.status, rota_id: data.rota_id, rota: rota ?? null };
  },

  async atualizarSeAberta(paradaId, dados) {
    const { data, error } = await supabase
      .from('paradas')
      .update(dados)
      .eq('id', paradaId)
      .in('status', STATUS_ABERTOS)
      .select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  async avancarProxima(rotaId) {
    const { data, error } = await supabase
      .from('paradas')
      .select('id, status, ordem, is_checkpoint')
      .eq('rota_id', rotaId)
      .order('ordem');
    if (error) throw error;
    const reais = (data ?? []).filter(
      (p: { is_checkpoint?: boolean | null }) => p.is_checkpoint !== false,
    ) as { id: string; status: string }[];
    if (reais.some((p) => p.status === 'em_andamento')) return;
    const proxima = reais.find((p) => p.status === 'pendente');
    if (!proxima) return;
    const { error: erroUpdate } = await supabase
      .from('paradas')
      .update({ status: 'em_andamento' })
      .eq('id', proxima.id)
      .eq('status', 'pendente');
    if (erroUpdate) throw erroUpdate;
  },
};

/**
 * Zera a trava e a fila de escrita.
 * @internal só para testes.
 */
export function _resetFilaAcoesParada(): void {
  processando = false;
  cadeia = Promise.resolve();
  ouvintes.clear();
}
