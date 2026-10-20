import {
  CODIGO_EMAIL_JA_CADASTRADO,
  MSG_EMAIL_JA_CADASTRADO,
  ehEmailDuplicadoNoAuth,
  escaparLike,
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

describe('escaparLike', () => {
  it('escapa os curingas do ILIKE e a própria barra', () => {
    expect(escaparLike('a_b%c\\d')).toBe('a\\_b\\%c\\\\d');
  });

  it('deixa e-mail comum como está', () => {
    expect(escaparLike('joao@x.com')).toBe('joao@x.com');
  });
});

describe('ehEmailDuplicadoNoAuth', () => {
  it.each([
    'A user with this email address has already been registered',
    'User already registered',
    'duplicate key value violates unique constraint "users_email_partial_key"',
  ])('reconhece "%s"', (msg) => {
    expect(ehEmailDuplicadoNoAuth(msg)).toBe(true);
  });

  it('não confunde outro erro com duplicata', () => {
    expect(
      ehEmailDuplicadoNoAuth('Password should be at least 6 characters'),
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
