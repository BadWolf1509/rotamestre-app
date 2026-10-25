/**
 * Colunas de `unidades` que o app lê. As consultas pedem lista explícita de
 * colunas — nunca asterisco, direto ou num join embutido do PostgREST —, com
 * esta lista como fonte única. O CNPJ, que a tela da unidade mostra ao
 * gestor, vem da RPC `cnpj_da_unidade`.
 *
 * Coluna nova que o app precise ler entra aqui. Guarda:
 * `src/lib/__tests__/consultas-unidades-colunas.test.ts`.
 */

/**
 * A lista no formato do `select` do PostgREST. Literal de tipo (`as const`):
 * interpolado num template também `as const`, o parser de tipos do supabase-js
 * continua inferindo o resultado (com `string` puro ele devolve ParserError).
 */
export const SELECT_UNIDADE_APP =
  'id, nome, cidade, endereco, telefone, email, ativa, created_at, updated_at, sede_latitude, sede_longitude, sede_endereco, uf, cep' as const;

/** As mesmas colunas, uma por item. */
export const COLUNAS_UNIDADE_APP: readonly string[] =
  SELECT_UNIDADE_APP.split(', ');
