/**
 * Peças comuns das listas paginadas no servidor (PostgREST).
 *
 * - `escaparIlike`: o termo digitado entra no `ilike` como TEXTO, não como
 *   padrão. `%` e `_` são curingas do LIKE e `\` é o escape dele; `*` é o
 *   curinga que o PostgREST troca por `%` antes de chegar ao banco, sem forma
 *   de escapar, então sai do termo. A vírgula não precisa de escape num
 *   filtro simples (`coluna=ilike.…`): o PostgREST só a lê como separador em
 *   `in.(…)` e em `or=(…)`. Por isso texto digitado NUNCA entra num `or()`
 *   aqui — o único `or` é o do cursor, montado com valores validados.
 * - `filtroKeysetDesc`: a página seguinte por cursor (keyset), em ordem
 *   decrescente com desempate por `id`. Com OFFSET, uma linha criada ou
 *   excluída entre um "carregar mais" e outro repetia ou pulava uma linha.
 */

/** Termo digitado → texto literal para `ilike` (sem os `%` das pontas). */
export function escaparIlike(termo: string): string {
  return termo
    .replace(/\*/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

const ID_SEGURO = /^[A-Za-z0-9-]+$/;

/**
 * `coluna < valor OR (coluna = valor AND id < id)` — a próxima página de uma
 * lista ordenada por `coluna desc, id desc`.
 *
 * O valor vai entre aspas (timestamp tem `:` e `+`), e só passa se casar com
 * `formatoValor`: o cursor vem da última linha que o próprio servidor
 * devolveu, mas um valor fora do formato aqui mudaria o filtro — recusa alto.
 */
export function filtroKeysetDesc(
  coluna: string,
  valor: string,
  id: string,
  formatoValor: RegExp,
): string {
  if (!formatoValor.test(valor) || !ID_SEGURO.test(id)) {
    throw new Error(`Cursor de paginação inválido: ${coluna}=${valor}`);
  }
  const v = `"${valor}"`;
  return `${coluna}.lt.${v},and(${coluna}.eq.${v},id.lt.${id})`;
}
