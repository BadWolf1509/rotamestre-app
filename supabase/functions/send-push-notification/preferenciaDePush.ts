// Decisão "envia ou não" pela preferência de push da conta (sem Deno/fetch),
// testável no Jest. A preferência mora em `preferencias_notificacao`
// (Migration 47, `20261024200000`), uma linha por conta, gravada pelo app.
//
// Regras:
// - SOS (`sos_acionado`) SEMPRE envia, qualquer que seja a preferência.
// - Sem linha, vale tudo ligado (é o default da tabela).
// - Consulta que falha ENVIA (falha aberta): o aviso importa mais que a
//   preferência. Isso cobre também a tabela que ainda não existe — a função
//   pode ser publicada ANTES da migration.
// - "Push geral" (`push_ativo`) desligado cala todas as categorias, menos o
//   SOS. Com ele ligado, cada categoria obedece ao próprio interruptor.

export interface PreferenciaDePush {
  push_ativo: boolean;
  incidentes: boolean;
  rotas: boolean;
  resumo_diario: boolean;
}

export type CategoriaDePush = 'sos' | 'incidente' | 'rota' | 'resumo' | 'geral';

export type MotivoDaDecisao =
  | 'sos'
  | 'sem_preferencia'
  | 'falha_na_consulta'
  | 'push_desligado'
  | 'categoria_desligada'
  | 'permitido';

interface ErroSupabase {
  code?: string;
  message: string;
}

interface Resposta {
  data?: unknown;
  error: ErroSupabase | null;
}

interface Filtro extends PromiseLike<Resposta> {
  eq(coluna: string, valor: unknown): Filtro;
}

export interface ClientePreferencia {
  from(tabela: string): { select(colunas: string): Filtro };
}

const COLUNAS = 'push_ativo, incidentes, rotas, resumo_diario';

// Os tipos que geram push estão em PUSH_NOTIFICATION_TYPES (index.ts), criados
// pelos gatilhos `notify_*` do banco. Hoje não há tipo de resumo; o prefixo
// `resumo_` fica reservado para quando houver. `direct` é a chamada direta
// (sem tipo do banco), que só obedece ao push geral.
export function categoriaDoTipo(tipo: string): CategoriaDePush {
  if (tipo === 'sos_acionado') return 'sos';
  if (tipo === 'incidente_reportado') return 'incidente';
  if (tipo.startsWith('resumo_')) return 'resumo';
  if (tipo === 'direct') return 'geral';
  return 'rota';
}

export function decidirEnvio(entrada: {
  tipo: string;
  preferencia: PreferenciaDePush | null;
  erro: string | null;
}): { envia: boolean; motivo: MotivoDaDecisao } {
  const categoria = categoriaDoTipo(entrada.tipo);
  if (categoria === 'sos') return { envia: true, motivo: 'sos' };
  if (entrada.erro) return { envia: true, motivo: 'falha_na_consulta' };

  const p = entrada.preferencia;
  if (!p) return { envia: true, motivo: 'sem_preferencia' };
  if (!p.push_ativo) return { envia: false, motivo: 'push_desligado' };

  const ligada =
    categoria === 'incidente'
      ? p.incidentes
      : categoria === 'rota'
        ? p.rotas
        : categoria === 'resumo'
          ? p.resumo_diario
          : true;
  return ligada
    ? { envia: true, motivo: 'permitido' }
    : { envia: false, motivo: 'categoria_desligada' };
}

// Só `false` explícito desliga: nulo ou ausente vale ligado, para um dado
// torto nunca calar o aviso.
const ligado = (v: unknown) => v !== false;

export async function lerPreferenciaDePush(
  cliente: ClientePreferencia,
  usuarioId: string,
): Promise<{ preferencia: PreferenciaDePush | null; erro: string | null }> {
  try {
    const { data, error } = await cliente
      .from('preferencias_notificacao')
      .select(COLUNAS)
      .eq('usuario_id', usuarioId);
    if (error) return { preferencia: null, erro: error.message };

    const linha = ((data ?? []) as Array<Record<string, unknown>>)[0];
    if (!linha) return { preferencia: null, erro: null };
    return {
      preferencia: {
        push_ativo: ligado(linha.push_ativo),
        incidentes: ligado(linha.incidentes),
        rotas: ligado(linha.rotas),
        resumo_diario: ligado(linha.resumo_diario),
      },
      erro: null,
    };
  } catch (error) {
    return {
      preferencia: null,
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}
