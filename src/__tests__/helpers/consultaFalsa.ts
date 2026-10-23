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

function valor(linha: LinhaFalsa, coluna: string): unknown {
  return coluna
    .split('.')
    .reduce<unknown>((o, k) => (o as LinhaFalsa | null)?.[k], linha);
}

function consulta(tabela: string) {
  const filtros: ((l: LinhaFalsa) => boolean)[] = [];
  let ordem: { coluna: string; asc: boolean } | null = null;
  let contar = false;
  const api = {
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
      resolve(
        contar
          ? { data: null, count: linhas.length, error: null }
          : { data: linhas, error: null },
      );
    },
  };
  return api;
}

export const moduloConsultaFalsa = {
  supabase: { from: (t: string) => consulta(t) },
  isSupabaseConfigured: true,
};
