// Compensação da criação de motorista: se o perfil ou o vínculo falham depois
// do createUser, a conta recém-criada é apagada para não sobrar só no Auth.
//
// O supabase-js devolve `{ error }` em vez de lançar; ignorar o retorno deixava
// a conta órfã passar em silêncio, e o e-mail ficava bloqueado para sempre pela
// recusa 409 de "já cadastrado" (a função, por desenho, nunca vincula nem apaga
// conta de terceiros). Aqui a falha da limpeza sempre deixa rastro no log da
// função, com o id da conta, para o suporte removê-la.

interface ClienteAdminAuth {
  auth: {
    admin: {
      deleteUser: (id: string) => Promise<{ error: unknown }>;
    };
  };
}

/** @returns `true` se a conta foi apagada; `false` se ficou órfã (já registrado). */
export async function desfazerContaCriada(
  admin: ClienteAdminAuth,
  userId: string,
  registrar: (mensagem: string, detalhe?: unknown) => void = console.error,
): Promise<boolean> {
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (!error) return true;
    registrar(
      `[criar-motorista] conta órfã no Auth (limpeza falhou): ${userId}`,
      error,
    );
  } catch (erro) {
    registrar(
      `[criar-motorista] conta órfã no Auth (limpeza lançou): ${userId}`,
      erro,
    );
  }
  return false;
}
