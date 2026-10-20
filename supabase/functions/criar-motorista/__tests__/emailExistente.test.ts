import {
  CODIGO_EMAIL_JA_CADASTRADO,
  MSG_EMAIL_JA_CADASTRADO,
  ehEmailDuplicadoNoAuth,
  normalizarEmail,
  respostaEmailJaCadastrado,
} from '../emailExistente';

describe('normalizarEmail', () => {
  it('tira espaço e passa para minúsculas, como o Auth guarda', () => {
    expect(normalizarEmail('  Joao.Silva@Exemplo.COM ')).toBe(
      'joao.silva@exemplo.com',
    );
  });
});

describe('ehEmailDuplicadoNoAuth', () => {
  it.each([
    'A user with this email address has already been registered',
    'User already registered',
    'duplicate key value violates unique constraint "users_email_partial_key"',
  ])('reconhece "%s"', (msg) => {
    expect(ehEmailDuplicadoNoAuth({ message: msg })).toBe(true);
  });

  it('prefere o código do GoTrue, que não muda com a tradução da mensagem', () => {
    expect(
      ehEmailDuplicadoNoAuth({ code: 'email_exists', message: 'qualquer' }),
    ).toBe(true);
  });

  it('não confunde outro erro com duplicata', () => {
    expect(
      ehEmailDuplicadoNoAuth({
        code: 'weak_password',
        message: 'Password should be at least 6 characters',
      }),
    ).toBe(false);
  });
});

describe('respostaEmailJaCadastrado', () => {
  it('recusa com 409 e a mensagem que não revela quem é', () => {
    expect(MSG_EMAIL_JA_CADASTRADO).toBe(
      'Este e-mail já tem uma conta no RotaMestre. Para usar o mesmo motorista em mais de uma loja, fale com o suporte.',
    );
    expect(respostaEmailJaCadastrado()).toEqual({
      status: 409,
      error: MSG_EMAIL_JA_CADASTRADO,
      codigo: CODIGO_EMAIL_JA_CADASTRADO,
    });
    expect(CODIGO_EMAIL_JA_CADASTRADO).toBe('email_ja_cadastrado');
  });
});
