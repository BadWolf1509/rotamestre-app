/**
 * Como o app chama a parada na frente do motorista. Os textos diziam
 * "entrega" mesmo numa retirada; `nome` vai no meio da frase ("a retirada"),
 * `titulo` abre título/rótulo. `tipo` chega como string em `ParadaData`, então
 * qualquer valor fora de entrega/retirada (origem, vazio) cai em "parada".
 */
export function rotuloTipoParada(tipo: string): {
  nome: string;
  titulo: string;
} {
  switch (tipo) {
    case 'entrega':
      return { nome: 'entrega', titulo: 'Entrega' };
    case 'retirada':
      return { nome: 'retirada', titulo: 'Retirada' };
    default:
      return { nome: 'parada', titulo: 'Parada' };
  }
}
