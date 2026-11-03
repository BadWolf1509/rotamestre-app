/**
 * Utilitários de documentos e números só com dígitos (telefone, CEP, CNPJ) e as regras
 * de formato que dependem só dos dígitos.
 */

/**
 * Remove tudo o que não é dígito. `null`/`undefined` viram `''`.
 */
export function soDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

/**
 * Telefone com DDD: 10 ou 11 dígitos, nada além disso. Mais frouxa que
 * `validatePhone` de propósito (não confere o DDD): é a regra do cadastro de
 * parada e da importação em lote.
 */
export function telefoneComDDD(valor: string | null | undefined): boolean {
  const digitos = soDigitos(valor);
  return digitos.length === 10 || digitos.length === 11;
}
