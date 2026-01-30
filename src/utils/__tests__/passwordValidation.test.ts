import { defaultTheme } from '@/utils/styles';

import { validatePasswordStrength, isPasswordValid } from '../passwordValidation';

describe('passwordValidation', () => {
  describe('validatePasswordStrength', () => {
    it('deve pontuar 0 para senha vazia', () => {
      const result = validatePasswordStrength('');
      expect(result.score).toBe(0);
      expect(result.label).toBe('Muito Fraca');
      expect(result.color).toBe(defaultTheme.colors.error);
    });

    it('deve pontuar corretamente critérios individuais', () => {
      // Apenas comprimento >= 8 (score 1) + minúsculas (score 1) = 2
      expect(validatePasswordStrength('abcdefgh').score).toBe(2);

      // Apenas maiúscula (mas < 8 chars) -> score 1
      expect(validatePasswordStrength('A').score).toBe(1);

      // Apenas número -> score 1
      expect(validatePasswordStrength('1').score).toBe(1);

      // Apenas especial -> score 1
      expect(validatePasswordStrength('!').score).toBe(1);
    });

    it('deve identificar senha muito forte', () => {
      // >= 12 chars, maiúscula, minúscula, número, especial
      const strongPass = 'SenhaForte123!';
      const result = validatePasswordStrength(strongPass);

      expect(result.score).toBeGreaterThanOrEqual(5);
      expect(result.feedback).toHaveLength(0);
    });

    it('deve retornar feedback correto para falhas', () => {
      const weakPass = 'abc';
      const result = validatePasswordStrength(weakPass);

      expect(result.feedback).toContain('Mínimo 8 caracteres');
      expect(result.feedback).toContain('Pelo menos 1 maiúscula');
      expect(result.feedback).toContain('Pelo menos 1 número');
      expect(result.feedback).toContain('Pelo menos 1 caractere especial (!@#$%&*)');
    });
  });

  describe('isPasswordValid', () => {
    it('deve retornar false para senha fraca', () => {
      expect(isPasswordValid('123456')).toBe(false);
    });

    it('deve retornar false para senha sem caractere especial', () => {
      // Score 4: 8 chars, maiúscula, minúscula, número (falta especial)
      expect(isPasswordValid('Senha123')).toBe(false);
    });

    it('deve retornar true para senha forte (score >= 5)', () => {
      // Score 5+: 8 chars, maiúscula, minúscula, número E especial
      expect(isPasswordValid('Senha123!')).toBe(true);
    });
  });
});
