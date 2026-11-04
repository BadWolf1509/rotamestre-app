/**
 * Cadeia falsa do query builder do Supabase para testes que só precisam de
 * UM resultado: todo método encadeável é um `jest.fn` que devolve a própria
 * cadeia, `single`/`maybeSingle` resolvem o resultado e a cadeia também é
 * aguardável sem terminal (`await supabase.from(t).select().eq(...)`).
 *
 * Não aplica filtro nenhum — para provar o recorte da consulta, use
 * `consultaFalsa`/`postgrestFalso`. Cadeia com comportamento próprio
 * (resultado por tabela, erro na 2ª chamada) continua local no teste.
 *
 * Uso:
 *   mockFrom.mockReturnValue(criarCadeia({ data: [...], error: null }));
 */

export interface ResultadoFalso<T> {
  data: T;
  error: unknown;
  count?: number | null;
}

const ENCADEAVEIS = [
  'select',
  'insert',
  'update',
  'delete',
  'upsert',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'is',
  'not',
  'or',
  'order',
  'limit',
  'range',
  // `.returns<T>()` devolve `this` na lib real: só informa o tipo.
  'returns',
] as const;

type Encadeavel = (typeof ENCADEAVEIS)[number];

export type CadeiaFalsa<T = unknown> = {
  [M in Encadeavel]: jest.Mock<CadeiaFalsa<T>>;
} & {
  single: jest.Mock<Promise<ResultadoFalso<T>>>;
  maybeSingle: jest.Mock<Promise<ResultadoFalso<T>>>;
  then: PromiseLike<ResultadoFalso<T>>['then'];
};

export function criarCadeia<T>(resultado: ResultadoFalso<T>): CadeiaFalsa<T> {
  const cadeia = {} as CadeiaFalsa<T>;
  for (const metodo of ENCADEAVEIS) {
    cadeia[metodo] = jest.fn(() => cadeia);
  }
  cadeia.single = jest.fn(() => Promise.resolve(resultado));
  cadeia.maybeSingle = jest.fn(() => Promise.resolve(resultado));
  cadeia.then = (aoResolver, aoRejeitar) =>
    Promise.resolve(resultado).then(aoResolver, aoRejeitar);
  return cadeia;
}
