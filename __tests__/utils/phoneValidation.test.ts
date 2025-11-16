/**
 * Testes unitários para utilitários de validação de telefone
 * @jest-environment node
 */

import {
  cleanPhone,
  formatPhone,
  validatePhone,
  maskPhone,
  getPhoneErrorMessage,
} from '@/utils/phoneValidation';

describe('phoneValidation utils', () => {
  describe('cleanPhone', () => {
    it('deve remover todos os caracteres não numéricos', () => {
      expect(cleanPhone('(11) 98765-4321')).toBe('11987654321');
      expect(cleanPhone('11 9 8765-4321')).toBe('11987654321');
      expect(cleanPhone('(11)98765-4321')).toBe('11987654321');
      expect(cleanPhone('abc123def456')).toBe('123456');
    });

    it('deve retornar string vazia para input vazio', () => {
      expect(cleanPhone('')).toBe('');
    });

    it('deve manter apenas números', () => {
      expect(cleanPhone('!@#$%^&*()')).toBe('');
      expect(cleanPhone('11-98765-4321')).toBe('11987654321');
    });
  });

  describe('formatPhone', () => {
    it('deve formatar celular com 11 dígitos corretamente', () => {
      expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
      expect(formatPhone('21987654321')).toBe('(21) 98765-4321');
    });

    it('deve formatar telefone fixo com 10 dígitos corretamente', () => {
      expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
      expect(formatPhone('2133334444')).toBe('(21) 3333-4444');
    });

    it('deve formatar parcialmente durante digitação', () => {
      expect(formatPhone('11')).toBe('(11');
      expect(formatPhone('119')).toBe('(11) 9');
      expect(formatPhone('1198')).toBe('(11) 98');
      expect(formatPhone('1198765')).toBe('(11) 9876-5');
      expect(formatPhone('119876543')).toBe('(11) 9876-543');
    });

    it('deve retornar string vazia para input vazio', () => {
      expect(formatPhone('')).toBe('');
    });

    it('deve lidar com números já formatados', () => {
      expect(formatPhone('(11) 98765-4321')).toBe('(11) 98765-4321');
    });
  });

  describe('validatePhone', () => {
    describe('números válidos', () => {
      it('deve validar celulares válidos (11 dígitos)', () => {
        expect(validatePhone('11987654321')).toBe(true);
        expect(validatePhone('(11) 98765-4321')).toBe(true);
        expect(validatePhone('21987654321')).toBe(true);
        expect(validatePhone('85987654321')).toBe(true);
      });

      it('deve validar telefones fixos válidos (10 dígitos)', () => {
        expect(validatePhone('1133334444')).toBe(true);
        expect(validatePhone('(11) 3333-4444')).toBe(true);
        expect(validatePhone('2133334444')).toBe(true);
      });
    });

    describe('números inválidos', () => {
      it('deve rejeitar números com menos de 10 dígitos', () => {
        expect(validatePhone('119876543')).toBe(false);
        expect(validatePhone('1198765')).toBe(false);
        expect(validatePhone('119')).toBe(false);
      });

      it('deve rejeitar números com mais de 11 dígitos', () => {
        expect(validatePhone('119876543210')).toBe(false);
      });

      it('deve rejeitar DDD inválido (menor que 11)', () => {
        expect(validatePhone('0987654321')).toBe(false);
        expect(validatePhone('1087654321')).toBe(false);
      });

      it('deve rejeitar celular que não começa com 9', () => {
        expect(validatePhone('11887654321')).toBe(false);
        expect(validatePhone('11787654321')).toBe(false);
      });

      it('deve rejeitar números com todos os dígitos iguais', () => {
        expect(validatePhone('11111111111')).toBe(false);
        expect(validatePhone('0000000000')).toBe(false);
      });

      it('deve rejeitar string vazia ou null', () => {
        expect(validatePhone('')).toBe(false);
      });
    });
  });

  describe('maskPhone', () => {
    it('deve aplicar máscara e limitar a 11 dígitos', () => {
      expect(maskPhone('11987654321')).toBe('(11) 98765-4321');
      expect(maskPhone('119876543210000')).toBe('(11) 98765-4321'); // Limita a 11
    });

    it('deve formatar durante digitação', () => {
      expect(maskPhone('1')).toBe('(1');
      expect(maskPhone('11')).toBe('(11');
      expect(maskPhone('119')).toBe('(11) 9');
      expect(maskPhone('1198')).toBe('(11) 98');
    });

    it('deve remover caracteres não numéricos antes de formatar', () => {
      expect(maskPhone('abc11def987ghi654jkl321')).toBe('(11) 98765-4321');
    });
  });

  describe('getPhoneErrorMessage', () => {
    it('deve retornar null para telefones válidos', () => {
      expect(getPhoneErrorMessage('11987654321')).toBeNull();
      expect(getPhoneErrorMessage('1133334444')).toBeNull();
    });

    it('deve retornar "Telefone incompleto" para números curtos', () => {
      expect(getPhoneErrorMessage('1198765')).toBe('Telefone incompleto');
      expect(getPhoneErrorMessage('119')).toBe('Telefone incompleto');
    });

    it('deve retornar "Telefone muito longo" para números longos', () => {
      expect(getPhoneErrorMessage('119876543210')).toBe('Telefone muito longo');
    });

    it('deve retornar "DDD inválido" para DDD < 11', () => {
      expect(getPhoneErrorMessage('0987654321')).toBe('DDD inválido');
      expect(getPhoneErrorMessage('1087654321')).toBe('DDD inválido');
    });

    it('deve retornar mensagem para celular sem 9 inicial', () => {
      expect(getPhoneErrorMessage('11887654321')).toBe('Celular deve começar com 9');
    });

    it('deve retornar "Celular deve começar com 9" para dígitos repetidos', () => {
      expect(getPhoneErrorMessage('11111111111')).toBe('Celular deve começar com 9');
    });

    it('deve retornar null para string vazia', () => {
      expect(getPhoneErrorMessage('')).toBeNull();
    });
  });
});
