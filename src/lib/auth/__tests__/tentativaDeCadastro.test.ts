/**
 * AN10: o limite de cadastro (anti-spam por e-mail) só conta tentativa que
 * CHEGOU ao servidor e foi recusada por abuso ou por causa do e-mail. Antes
 * contava qualquer erro: três quedas de rede ou três senhas fracas travavam
 * a pessoa por minutos, sem ela ter feito nada de abusivo.
 */
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { contaComoTentativaDeCadastro } from '../tentativaDeCadastro';

describe('contaComoTentativaDeCadastro', () => {
  it.each([
    ['e-mail já cadastrado', new AuthApiError('exists', 422, 'user_already_exists')],
    ['e-mail já cadastrado (código antigo)', new AuthApiError('exists', 422, 'email_exists')],
    ['e-mail já cadastrado (só a mensagem)', new Error('User already registered')],
    ['e-mail inválido', new AuthApiError('bad', 400, 'email_address_invalid')],
    ['e-mail não autorizado', new AuthApiError('no', 400, 'email_address_not_authorized')],
    ['limite de envio de e-mail do servidor', new AuthApiError('slow', 429, 'over_email_send_rate_limit')],
    ['limite de requisições do servidor', new AuthApiError('slow', 429, 'over_request_rate_limit')],
  ])('conta: %s', (_n, erro) => {
    expect(contaComoTentativaDeCadastro(erro)).toBe(true);
  });

  it.each([
    ['falta de rede (supabase-js)', new AuthRetryableFetchError('Failed to fetch', 0)],
    ['TypeError do fetch', new TypeError('Failed to fetch')],
    ['mensagem de rede', new Error('Network request failed')],
    ['senha fraca recusada pelo servidor', new AuthApiError('weak', 422, 'weak_password')],
    ['validação do corpo', new AuthApiError('bad', 400, 'validation_failed')],
    ['cadastro fechado', new AuthApiError('off', 422, 'signup_disabled')],
    ['5xx do servidor', new AuthApiError('boom', 500, 'unexpected_failure')],
    ['erro desconhecido', new Error('algo inesperado')],
    ['valor que nem é Error', 'falhou'],
  ])('não conta: %s', (_n, erro) => {
    expect(contaComoTentativaDeCadastro(erro)).toBe(false);
  });
});
