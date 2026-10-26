/**
 * Carga sob demanda de bibliotecas pesadas (xlsx).
 *
 * Só o `import()` fica dentro do try: qualquer falha ali é falha de carga do
 * chunk (típico no web: aba aberta antes de um deploy pede um chunk com hash
 * antigo e leva 404; o service worker serve /_expo/static cache-first). Isso é
 * mais robusto do que reconhecer a mensagem do erro, que muda entre Metro,
 * Chrome e Safari. Diferente de um erro ao GERAR o arquivo, este tem remédio
 * para o usuário: atualizar a página.
 */

export const MENSAGEM_FALHA_CARGA =
  'Atualize a página e tente exportar de novo.';

export class FalhaCargaBibliotecaError extends Error {
  constructor(cause: unknown) {
    super('Falha ao carregar a biblioteca de exportação');
    this.name = 'FalhaCargaBibliotecaError';
    this.cause = cause;
  }
}

export async function carregarBiblioteca<T>(
  importar: () => Promise<T>,
): Promise<T> {
  try {
    return await importar();
  } catch (error) {
    throw new FalhaCargaBibliotecaError(error);
  }
}
