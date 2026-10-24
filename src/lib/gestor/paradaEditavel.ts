/**
 * Quando o gestor pode editar ou remover uma parada.
 *
 * Só parada `pendente` de rota `pendente` ou `em_andamento`. Concluída e
 * pulada são entrega feita (com foto e log); `em_andamento` é a que o
 * motorista está fazendo agora; rota concluída, cancelada ou não executada
 * está fechada. Uma só regra para o cartão (esconde os botões) e para os
 * handlers (recusam o clique que chegou de um retrato velho). A trava do
 * banco (Migration 53) vale para qualquer cliente.
 */
export function podeAlterarParada(
  statusDaParada: string | undefined,
  statusDaRota: string | undefined,
): boolean {
  return (
    statusDaParada === 'pendente' &&
    (statusDaRota === 'pendente' || statusDaRota === 'em_andamento')
  );
}

export const MENSAGEM_PARADA_JA_FINALIZADA =
  'Esta parada já foi finalizada pelo motorista e não pode mais ser alterada. A tela foi atualizada.';
