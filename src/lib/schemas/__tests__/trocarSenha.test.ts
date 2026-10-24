/**
 * AN8: a troca de senha (gestor e motorista) usa a MESMA regra do cadastro e da
 * redefinição. Antes o motorista aceitava 6 caracteres sem maiúscula/símbolo.
 */
import {
  registerSchema,
  resetPasswordSchema,
  trocarSenhaSchema,
} from '../auth';
import { passwordSchema } from '../basic';

const VALIDA = 'NovaSenha@123';

function caso(sobre: Partial<Record<string, string>> = {}) {
  return {
    senhaAtual: 'antiga',
    novaSenha: VALIDA,
    confirmarSenha: VALIDA,
    ...sobre,
  };
}

function mensagens(entrada: ReturnType<typeof caso>, campo: string) {
  const r = trocarSenhaSchema.safeParse(entrada);
  if (r.success) return [];
  return r.error.issues
    .filter((i) => i.path[0] === campo)
    .map((i) => i.message);
}

describe('trocarSenhaSchema', () => {
  it('aceita senha atual, nova válida e confirmação igual', () => {
    expect(trocarSenhaSchema.safeParse(caso()).success).toBe(true);
  });

  it('exige a senha atual', () => {
    expect(mensagens(caso({ senhaAtual: '' }), 'senhaAtual')).toEqual([
      'Digite sua senha atual',
    ]);
  });

  it.each([
    ['6 caracteres (regra antiga do motorista)', 'Ab@1de'],
    ['sem maiúscula', 'novasenha@123'],
    ['sem minúscula', 'NOVASENHA@123'],
    ['sem número', 'NovaSenha@abc'],
    ['sem caractere especial', 'NovaSenha123'],
  ])('recusa a nova senha %s', (_nome, nova) => {
    expect(
      mensagens(caso({ novaSenha: nova, confirmarSenha: nova }), 'novaSenha')
        .length,
    ).toBeGreaterThan(0);
  });

  it('a regra da nova senha é exatamente a do cadastro e da redefinição', () => {
    const amostras = ['Ab@1de', 'NovaSenha123', VALIDA, 'a', 'ABCDEFG@1'];
    for (const s of amostras) {
      const esperado = passwordSchema.safeParse(s).success;
      expect(
        trocarSenhaSchema.safeParse(
          caso({ novaSenha: s, confirmarSenha: s }),
        ).success,
      ).toBe(esperado);
      expect(
        resetPasswordSchema.safeParse({ password: s, confirmPassword: s })
          .success,
      ).toBe(esperado);
      expect(
        registerSchema.safeParse({
          nome: 'Fulano Silva',
          email: 'a@b.com',
          password: s,
          confirmPassword: s,
        }).success,
      ).toBe(esperado);
    }
  });

  it('recusa confirmação diferente, no campo da confirmação', () => {
    expect(
      mensagens(caso({ confirmarSenha: 'Outra@12345' }), 'confirmarSenha'),
    ).toEqual(['As senhas não coincidem']);
  });

  it('recusa nova senha igual à atual, no campo da nova senha', () => {
    expect(
      mensagens(caso({ senhaAtual: VALIDA }), 'novaSenha'),
    ).toEqual(['A nova senha deve ser diferente da atual']);
  });
});
