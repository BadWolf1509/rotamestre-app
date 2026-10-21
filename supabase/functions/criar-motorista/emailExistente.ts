// Decisão pura (sem Deno/URL) sobre e-mail que já tem conta. Testável no Jest.
//
// A função não vincula conta existente: qualquer gestor que soubesse o e-mail
// de um motorista o puxava para a própria loja, sem o consentimento dele. Até
// existir um convite aceito pelo motorista, o vínculo multi-loja é com o suporte.

export const CODIGO_EMAIL_JA_CADASTRADO = 'email_ja_cadastrado';

export const MSG_EMAIL_JA_CADASTRADO =
  'Este e-mail já tem uma conta no RotaMestre. Para usar o mesmo motorista em mais de uma loja, fale com o suporte.';

export interface RespostaEmailJaCadastrado {
  status: 409;
  error: string;
  codigo: string;
}

// O Auth guarda o e-mail em minúsculas; comparar com o digitado deixava
// `Joao@x.com` e `joao@x.com` como contas diferentes de um lado e iguais do outro.
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

// O código do GoTrue (`email_exists`) não depende do texto; a mensagem fica
// como reserva para versão que não mande `code`.
export function ehEmailDuplicadoNoAuth(err: {
  code?: string;
  message: string;
}): boolean {
  if (err.code === 'email_exists') return true;
  const m = err.message.toLowerCase();
  return (
    m.includes('already been registered') ||
    m.includes('already registered') ||
    m.includes('duplicate') ||
    m.includes('unique constraint')
  );
}

// Mesma resposta para conta com perfil e conta só no Auth (gestor no meio do
// onboarding): não dá para distinguir quem é pelo erro.
export function respostaEmailJaCadastrado(): RespostaEmailJaCadastrado {
  return {
    status: 409,
    error: MSG_EMAIL_JA_CADASTRADO,
    codigo: CODIGO_EMAIL_JA_CADASTRADO,
  };
}
