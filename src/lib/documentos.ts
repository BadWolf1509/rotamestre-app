/**
 * Utilitários de documentos e números só com dígitos (telefone, CEP, CNPJ).
 */

/**
 * Remove tudo o que não é dígito. `null`/`undefined` viram `''`.
 */
export function soDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}
