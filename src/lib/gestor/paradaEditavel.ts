/**
 * Quando o gestor pode editar ou remover uma parada. A regra mora aqui e só
 * aqui: o cartão (esconde os botões), os handlers (recusam o clique que veio
 * de um retrato velho), o DELETE de `routeUtils` e o UPDATE de
 * `useEditStopForm` (condicionam a escrita ao status) leem a mesma constante.
 *
 * Só parada `pendente` de rota `pendente` ou `em_andamento`.
 * - Concluída e pulada são entrega feita (com foto e log): o banco também
 *   recusa (Migration 53).
 * - `em_andamento` é a parada que o motorista está fazendo agora. Decisão: o
 *   gestor NÃO a edita nem a remove. Mudar o destino ou apagar a parada sob o
 *   motorista que já está navegando para ela é o mesmo estrago de uma tela
 *   velha, só que sem a trava do banco (que só protege o que já foi feito),
 *   e a UI nunca ofereceu essa ação. Corrigir a parada em andamento exige que
 *   o motorista a conclua ou pule antes. Não é regra do banco de propósito:
 *   o RPC/backoffice pode precisar mexer nela.
 * - Rota concluída, cancelada ou não executada está fechada.
 */
export const STATUS_PARADA_ALTERAVEL = 'pendente';

export function podeAlterarParada(
  statusDaParada: string | undefined,
  statusDaRota: string | undefined,
): boolean {
  return (
    statusDaParada === STATUS_PARADA_ALTERAVEL &&
    (statusDaRota === 'pendente' || statusDaRota === 'em_andamento')
  );
}

export const MENSAGEM_PARADA_JA_FINALIZADA =
  'Esta parada já foi finalizada pelo motorista e não pode mais ser alterada. A tela foi atualizada.';

export const MENSAGEM_PARADA_JA_INICIADA =
  'O motorista já iniciou esta parada e ela não pode mais ser alterada. A tela foi atualizada.';

/** Aviso certo para o estado vivo de uma parada que deixou de ser alterável. */
export function mensagemParadaNaoAlteravel(
  statusDaParada: string | undefined,
): string {
  return statusDaParada === 'em_andamento'
    ? MENSAGEM_PARADA_JA_INICIADA
    : MENSAGEM_PARADA_JA_FINALIZADA;
}
