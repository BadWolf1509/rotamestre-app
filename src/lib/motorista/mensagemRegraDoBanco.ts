/**
 * Regra de negócio levantada pelo banco com P0001 — as RPCs e o trigger de
 * motorista que atende outra loja já escrevem a frase em português para o
 * gestor ler. Qualquer outro erro devolve null (quem chama usa o genérico).
 */
export function mensagemRegraDoBanco(error: unknown): string | null {
  if (!error || typeof error !== 'object' || error instanceof Error) {
    return null;
  }
  const { code, message } = error as { code?: string; message?: string };
  return code === 'P0001' && message ? message : null;
}
