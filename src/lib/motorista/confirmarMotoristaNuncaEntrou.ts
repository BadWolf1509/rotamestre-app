/**
 * Confirmação antes de mandar rota a quem nunca entrou no app.
 *
 * A rota é lançada para o `usuarios.id` escolhido; se a pessoa ainda não fez
 * login (`ultimo_login` nulo), ela pode usar outra conta e nunca ver a rota.
 */

type OpcoesConfirmacao = {
  title: string;
  message: string;
  type: 'warning';
  confirmText: string;
};

export type ShowConfirmFn = (opcoes: OpcoesConfirmacao) => Promise<boolean>;

export const ROTULO_NUNCA_ENTROU = 'Nunca entrou no app';

/** `true` = pode seguir (nada a avisar, ou o gestor confirmou). */
export async function confirmarMotoristaNuncaEntrou(
  showConfirm: ShowConfirmFn,
  motorista: { nome: string; nuncaEntrou?: boolean } | null | undefined,
  acao: 'lancar' | 'trocar',
): Promise<boolean> {
  if (!motorista?.nuncaEntrou) return true;
  return showConfirm({
    title: 'Motorista nunca entrou no app',
    message: `${motorista.nome} ainda não entrou no RotaMestre e não vai ver esta rota no celular. Confira se ele usa outra conta ou peça que instale o app e faça login.`,
    type: 'warning',
    confirmText:
      acao === 'lancar' ? 'Lançar mesmo assim' : 'Trocar mesmo assim',
  });
}
