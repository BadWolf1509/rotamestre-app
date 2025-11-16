import { validatePasswordStrength, isPasswordValid } from '../passwordValidation';

describe('Password Validation', () => {
  describe('validatePasswordStrength', () => {
    describe('Score 0-1: Muito Fraca', () => {
      it('deve retornar "Muito Fraca" para senha vazia', () => {
        const result = validatePasswordStrength('');
        expect(result.score).toBe(0);
        expect(result.label).toBe('Muito Fraca');
        expect(result.color).toBe('#ef4444');
        expect(result.feedback).toHaveLength(5);
      });

      it('deve retornar "Muito Fraca" para senha curta sem requisitos', () => {
        const result = validatePasswordStrength('abc');
        expect(result.score).toBe(1);
        expect(result.label).toBe('Muito Fraca');
        expect(result.color).toBe('#ef4444');
        expect(result.feedback).toContain('Mínimo 8 caracteres');
      });

      it('deve retornar "Muito Fraca" para senha apenas números', () => {
        const result = validatePasswordStrength('12345');
        expect(result.score).toBe(1);
        expect(result.label).toBe('Muito Fraca');
      });
    });

    describe('Score 2: Fraca', () => {
      it('deve retornar "Fraca" para senha com 8+ caracteres e minúsculas', () => {
        const result = validatePasswordStrength('abcdefgh');
        expect(result.score).toBe(2);
        expect(result.label).toBe('Fraca');
        expect(result.color).toBe('#f59e0b');
      });

      it('deve retornar "Fraca" para senha com minúsculas e números', () => {
        const result = validatePasswordStrength('abc123');
        expect(result.score).toBe(2);
        expect(result.label).toBe('Fraca');
      });
    });

    describe('Score 3: Regular', () => {
      it('deve retornar "Regular" para senha com 8+ chars, maiúsculas e minúsculas', () => {
        const result = validatePasswordStrength('AbcDefgh');
        expect(result.score).toBe(3);
        expect(result.label).toBe('Regular');
        expect(result.color).toBe('#f7a02a');
      });

      it('deve retornar "Regular" para senha com minúsculas, maiúsculas e números', () => {
        const result = validatePasswordStrength('Abc123');
        expect(result.score).toBe(3);
        expect(result.label).toBe('Regular');
      });
    });

    describe('Score 4: Boa', () => {
      it('deve retornar "Boa" para senha com 8+ chars, maiúsculas, minúsculas e números', () => {
        const result = validatePasswordStrength('AbcDef12');
        expect(result.score).toBe(4);
        expect(result.label).toBe('Boa');
        expect(result.color).toBe('#10b981');
      });

      it('deve retornar "Boa" para senha com todos requisitos exceto especial', () => {
        const result = validatePasswordStrength('Password123');
        expect(result.score).toBe(4);
        expect(result.label).toBe('Boa');
        expect(result.feedback).toContain('Pelo menos 1 caractere especial (!@#$%&*)');
      });
    });

    describe('Score 5: Forte', () => {
      it('deve retornar "Forte" para senha com todos os requisitos básicos', () => {
        const result = validatePasswordStrength('AbcDef12!');
        expect(result.score).toBe(5);
        expect(result.label).toBe('Forte');
        expect(result.color).toBe('#284093');
        expect(result.feedback).toHaveLength(0);
      });

      it('deve retornar "Forte" para senha completa com caractere especial @', () => {
        const result = validatePasswordStrength('P@ssw0rd');
        expect(result.score).toBe(5);
        expect(result.label).toBe('Forte');
      });
    });

    describe('Score 6: Muito Forte', () => {
      it('deve retornar "Muito Forte" para senha com 12+ caracteres e todos requisitos', () => {
        const result = validatePasswordStrength('AbcDef123!@#');
        expect(result.score).toBe(6);
        expect(result.label).toBe('Muito Forte');
        expect(result.color).toBe('#1b2c63');
        expect(result.feedback).toHaveLength(0);
      });

      it('deve retornar "Muito Forte" para senha longa e complexa', () => {
        const result = validatePasswordStrength('MySecureP@ssw0rd2024!');
        expect(result.score).toBe(6);
        expect(result.label).toBe('Muito Forte');
      });
    });

    describe('Feedback messages', () => {
      it('deve dar feedback para senha sem maiúsculas', () => {
        const result = validatePasswordStrength('password123!');
        expect(result.feedback).toContain('Pelo menos 1 maiúscula');
      });

      it('deve dar feedback para senha sem minúsculas', () => {
        const result = validatePasswordStrength('PASSWORD123!');
        expect(result.feedback).toContain('Pelo menos 1 minúscula');
      });

      it('deve dar feedback para senha sem números', () => {
        const result = validatePasswordStrength('Password!');
        expect(result.feedback).toContain('Pelo menos 1 número');
      });

      it('deve dar feedback para senha sem caracteres especiais', () => {
        const result = validatePasswordStrength('Password123');
        expect(result.feedback).toContain('Pelo menos 1 caractere especial (!@#$%&*)');
      });

      it('deve dar feedback para senha curta', () => {
        const result = validatePasswordStrength('Pw1!');
        expect(result.feedback).toContain('Mínimo 8 caracteres');
      });

      it('não deve dar feedback quando todos requisitos são atendidos', () => {
        const result = validatePasswordStrength('SecureP@ss1');
        expect(result.feedback).toHaveLength(0);
      });
    });

    describe('Casos especiais de caracteres', () => {
      it('deve aceitar diversos caracteres especiais', () => {
        const specialChars = ['!', '@', '#', '$', '%', '&', '*', '-', '_', '+', '='];

        specialChars.forEach(char => {
          const result = validatePasswordStrength(`Password123${char}`);
          expect(result.score).toBeGreaterThanOrEqual(5);
        });
      });

      it('deve aceitar espaços como caractere especial', () => {
        const result = validatePasswordStrength('Pass word 123');
        expect(result.score).toBeGreaterThanOrEqual(5);
      });

      it('deve aceitar parênteses como caractere especial', () => {
        const result = validatePasswordStrength('Pass(word)123');
        expect(result.score).toBeGreaterThanOrEqual(5);
      });
    });

    describe('Comprimento da senha', () => {
      it('deve dar bônus para senhas com 12+ caracteres', () => {
        const short = validatePasswordStrength('Pass1!ab');
        const long = validatePasswordStrength('Pass1!abcdef');

        expect(short.score).toBe(5);
        expect(long.score).toBe(6);
      });

      it('deve dar bônus mesmo para senhas fracas longas', () => {
        const result = validatePasswordStrength('abcdefghijkl');
        expect(result.score).toBeGreaterThan(2);
      });
    });
  });

  describe('isPasswordValid', () => {
    it('deve retornar true para senhas com score >= 4', () => {
      expect(isPasswordValid('AbcDef12')).toBe(true);
      expect(isPasswordValid('Pass123!')).toBe(true);
      expect(isPasswordValid('SecurePassword1!')).toBe(true);
    });

    it('deve retornar false para senhas com score < 4', () => {
      expect(isPasswordValid('abc')).toBe(false);
      expect(isPasswordValid('password')).toBe(false);
      expect(isPasswordValid('12345678')).toBe(false);
      expect(isPasswordValid('Abc123')).toBe(false);
    });

    it('deve retornar false para senha vazia', () => {
      expect(isPasswordValid('')).toBe(false);
    });

    it('deve aceitar senha com score exatamente 4', () => {
      expect(isPasswordValid('Password123')).toBe(true);
    });

    it('deve aceitar senha com score 5', () => {
      expect(isPasswordValid('Password123!')).toBe(true);
    });

    it('deve aceitar senha com score 6', () => {
      expect(isPasswordValid('SecurePassword123!')).toBe(true);
    });
  });

  describe('Casos de borda', () => {
    it('deve lidar com strings muito longas', () => {
      const longPassword = 'P@ssw0rd' + 'a'.repeat(100);
      const result = validatePasswordStrength(longPassword);
      expect(result.score).toBe(6);
      expect(result.label).toBe('Muito Forte');
    });

    it('deve lidar com Unicode e emojis', () => {
      const result = validatePasswordStrength('Pass123!😀');
      expect(result.score).toBeGreaterThanOrEqual(5);
    });

    it('deve lidar com apenas caracteres especiais', () => {
      const result = validatePasswordStrength('!@#$%^&*()');
      expect(result.score).toBeGreaterThan(0);
    });
  });
});
