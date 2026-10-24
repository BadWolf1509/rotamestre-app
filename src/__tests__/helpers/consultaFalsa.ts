/**
 * Supabase FALSO genérico para testes de leitura: aplica de verdade os
 * filtros eq/neq/gte/lte/in/is (inclusive em coluna de tabela embutida,
 * `rotas.unidade_id`) e a ordenação sobre linhas em memória, em vez de mock
 * que só registra chamadas. Um teste que passa aqui prova o recorte que a
 * consulta pede, não a sequência de métodos chamados.
 *
 * Não modela RLS, joins nem `select` de colunas: a linha já vem com os
 * objetos embutidos que a consulta pediria.
 *
 * Uso:
 *   jest.mock('@/lib/supabase', () =>
 *     require('@/__tests__/helpers/consultaFalsa').moduloConsultaFalsa);
 *   tabelasFalsas.incidentes = [...];
 */

export type LinhaFalsa = Record<string, unknown>;

export const tabelasFalsas: Record<string, LinhaFalsa[]> = {};

/**
 * Toda escrita (update/insert/delete/upsert) pedida é registrada aqui e
 * "dá certo" sem mudar as linhas — para provar que um caminho de LEITURA não
 * escreve no banco.
 */
export const escritasFalsas: { tabela: string; operacao: string }[] = [];

function valor(linha: LinhaFalsa, coluna: string): unknown {
  return coluna
    .split('.')
    .reduce<unknown>((o, k) => (o as LinhaFalsa | null)?.[k], linha);
}

function consulta(tabela: string) {
  const filtros: ((l: LinhaFalsa) => boolean)[] = [];
  let ordem: { coluna: string; asc: boolean } | null = null;
  let contar = false;
  let limite: number | null = null;
  const escrever = (operacao: string) => () => {
    escritasFalsas.push({ tabela, operacao });
    return api;
  };
  const api = {
    update: escrever('update'),
    insert: escrever('insert'),
    upsert: escrever('upsert'),
    delete: escrever('delete'),
    select: (_c?: string, opts?: { head?: boolean }) => {
      contar = !!opts?.head;
      return api;
    },
    eq: (c: string, v: unknown) => {
      filtros.push((l) => valor(l, c) === v);
      return api;
    },
    neq: (c: string, v: unknown) => {
      filtros.push((l) => valor(l, c) !== v);
      return api;
    },
    gte: (c: string, v: string) => {
      filtros.push((l) => String(valor(l, c)) >= v);
      return api;
    },
    lte: (c: string, v: string) => {
      filtros.push((l) => String(valor(l, c)) <= v);
      return api;
    },
    in: (c: string, vs: unknown[]) => {
      filtros.push((l) => vs.includes(valor(l, c)));
      return api;
    },
    is: (c: string, v: unknown) => {
      filtros.push((l) => (valor(l, c) ?? null) === v);
      return api;
    },
    order: (coluna: string, opts?: { ascending?: boolean }) => {
      ordem = { coluna, asc: opts?.ascending ?? true };
      return api;
    },
    limit: (n: number) => {
      limite = n;
      return api;
    },
    // `.returns<T>()` só informa o tipo na lib real.
    returns: () => api,
    // `.single()` sem linha é 406 + PGRST116 no PostgREST real;
    // `.maybeSingle()` devolve data null. Mais de uma linha: erro nos dois.
    single: async () => {
      const linhas = (tabelasFalsas[tabela] ?? []).filter((l) =>
        filtros.every((f) => f(l)),
      );
      return linhas.length === 1
        ? { data: linhas[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: '406' } };
    },
    maybeSingle: async () => {
      const linhas = (tabelasFalsas[tabela] ?? []).filter((l) =>
        filtros.every((f) => f(l)),
      );
      return linhas.length > 1
        ? { data: null, error: { code: 'PGRST116', message: 'várias' } }
        : { data: linhas[0] ?? null, error: null };
    },
    then: (resolve: (v: unknown) => void) => {
      let linhas = (tabelasFalsas[tabela] ?? []).filter((l) =>
        filtros.every((f) => f(l)),
      );
      if (ordem) {
        const { coluna, asc } = ordem;
        linhas = [...linhas].sort((a, b) => {
          const x = String(valor(a, coluna));
          const y = String(valor(b, coluna));
          return asc ? x.localeCompare(y) : y.localeCompare(x);
        });
      }
      if (limite !== null) linhas = linhas.slice(0, limite);
      resolve(
        contar
          ? { data: null, count: linhas.length, error: null }
          : { data: linhas, error: null },
      );
    },
  };
  return api;
}

// Realtime inerte: hooks que assinam canal montam sem rede e sem evento.
const canalFalso: Record<string, unknown> = {};
canalFalso.on = () => canalFalso;
canalFalso.subscribe = () => canalFalso;

export const moduloConsultaFalsa = {
  supabase: {
    from: (t: string) => consulta(t),
    channel: () => canalFalso,
    removeChannel: () => undefined,
  },
  isSupabaseConfigured: true,
};
