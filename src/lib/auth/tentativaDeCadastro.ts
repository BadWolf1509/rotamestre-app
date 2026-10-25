/**
 * Esta falha do `signUp` conta para o limite de cadastro (`signupRateLimiter`)?
 *
 * O limite é anti-spam por e-mail. Só conta a tentativa que CHEGOU ao servidor
 * e foi recusada por abuso (limite de e-mail/requisições do próprio Supabase)
 * ou por causa do e-mail (já cadastrado, inválido, não autorizado). Antes
 * contava qualquer erro: a rede caindo três vezes, ou três senhas fracas,
 * trancava a pessoa por minutos sem nada de abusivo.
 *
 * FORMA ESCOLHIDA: lista do que conta (por código do Supabase), não lista do
 * que não conta. Erro novo ou desconhecido cai em "não conta": o pior caso é
 * deixar passar uma tentativa (o servidor tem o próprio limite), em vez de
 * trancar alguém por um erro que não entendemos. A outra forma, negar rede e
 * senha fraca e contar o resto, trancaria por 5xx e `validation_failed`.
 *
 * Fica de fora de propósito: `weak_password` (a pessoa está corrigindo a
 * senha; a tela já valida antes), `validation_failed`, `signup_disabled`,
 * 5xx e qualquer falha de rede.
 */
const CODIGOS_QUE_CONTAM = new Set([
  'user_already_exists',
  'email_exists',
  'email_address_invalid',
  'email_address_not_authorized',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
]);

export function contaComoTentativaDeCadastro(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const { code, message } = erro as { code?: unknown; message?: unknown };

  if (typeof code === 'string' && CODIGOS_QUE_CONTAM.has(code)) return true;

  // Respostas antigas do Auth vinham sem `code`, só com a mensagem.
  return (
    typeof message === 'string' &&
    /already.*registered|already.*exists/i.test(message)
  );
}
