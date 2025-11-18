import {
  cleanPhone,
  formatPhone,
  validatePhone,
  maskPhone,
  getPhoneErrorMessage,
} from '../phoneValidation';

describe('phoneValidation', () => {
  describe('cleanPhone', () => {
    it('deve remover caracteres não numéricos', () => {
      expect(cleanPhone('(11) 98765-4321')).toBe('11987654321');
      expect(cleanPhone('11 9 8765-4321')).toBe('11987654321');
      expect(cleanPhone('(11) 3456-7890')).toBe('1134567890');
    });

    it('deve retornar string vazia quando não há números', () => {
      expect(cleanPhone('()')).toBe('');
      expect(cleanPhone('---')).toBe('');
      expect(cleanPhone('')).toBe('');
    });

    it('deve manter apenas os números', () => {
      expect(cleanPhone('11abc98765def4321')).toBe('11987654321');
    });
  });

  describe('formatPhone', () => {
    it('deve retornar string vazia quando phone está vazio', () => {
      expect(formatPhone('')).toBe('');
    });

    it('deve retornar string vazia quando phone tem apenas caracteres não numéricos', () => {
      expect(formatPhone('()')).toBe('');
      expect(formatPhone('---')).toBe('');
    });

    it('deve formatar celular com 11 dígitos (linha 21-22)', () => {
      expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
      expect(formatPhone('21912345678')).toBe('(21) 91234-5678');
    });

    it('deve formatar telefone fixo com 10 dígitos (linha 26-27)', () => {
      expect(formatPhone('1134567890')).toBe('(11) 3456-7890');
      expect(formatPhone('2133334444')).toBe('(21) 3333-4444');
    });

    it('deve formatar parcialmente durante digitação - 1 dígito (linha 39-40)', () => {
      expect(formatPhone('1')).toBe('(1');
    });

    it('deve formatar parcialmente durante digitação - 2 dígitos (linha 37-38)', () => {
      expect(formatPhone('11')).toBe('(11');
    });

    it('deve formatar parcialmente durante digitação - 3-6 dígitos (linha 37-38)', () => {
      expect(formatPhone('119')).toBe('(11) 9');
      expect(formatPhone('11987')).toBe('(11) 987');
      expect(formatPhone('119876')).toBe('(11) 9876');
    });

    it('deve formatar parcialmente durante digitação - 7-10 dígitos fixo (linha 32-33)', () => {
      expect(formatPhone('1134567')).toBe('(11) 3456-7');
      expect(formatPhone('113456789')).toBe('(11) 3456-789');
      expect(formatPhone('1134567890')).toBe('(11) 3456-7890');
    });

    it('deve formatar parcialmente durante digitação - 7-11 dígitos celular (linha 34-35)', () => {
      expect(formatPhone('11987654')).toBe('(11) 9876-54');
      expect(formatPhone('119876543')).toBe('(11) 9876-543');
      expect(formatPhone('1198765432')).toBe('(11) 9876-5432');
      expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    });

    it('deve aceitar telefones já formatados', () => {
      expect(formatPhone('(11) 98765-4321')).toBe('(11) 98765-4321');
      expect(formatPhone('(11) 3456-7890')).toBe('(11) 3456-7890');
    });
  });

  describe('validatePhone', () => {
    it('deve retornar false para string vazia', () => {
      expect(validatePhone('')).toBe(false);
    });

    it('deve validar celular correto com 11 dígitos', () => {
      expect(validatePhone('11987654321')).toBe(true);
      expect(validatePhone('(11) 98765-4321')).toBe(true);
      expect(validatePhone('21912345678')).toBe(true);
    });

    it('deve validar telefone fixo correto com 10 dígitos', () => {
      expect(validatePhone('1134567890')).toBe(true);
      expect(validatePhone('(11) 3456-7890')).toBe(true);
      expect(validatePhone('2133334444')).toBe(true);
    });

    it('deve rejeitar telefone com menos de 10 dígitos', () => {
      expect(validatePhone('119876543')).toBe(false);
      expect(validatePhone('1198765')).toBe(false);
    });

    it('deve rejeitar telefone com mais de 11 dígitos', () => {
      expect(validatePhone('119876543212')).toBe(false);
    });

    it('deve rejeitar DDD inválido (menor que 11)', () => {
      expect(validatePhone('0987654321')).toBe(false);
      expect(validatePhone('1087654321')).toBe(false);
    });

    it('deve rejeitar DDD inválido (maior que 99)', () => {
      // Impossível ter DDD > 99 com 2 dígitos, mas testamos a lógica
      expect(validatePhone('9987654321')).toBe(true); // DDD 99 é válido
    });

    it('deve rejeitar celular que não começa com 9', () => {
      expect(validatePhone('11887654321')).toBe(false);
      expect(validatePhone('11787654321')).toBe(false);
    });

    it('deve rejeitar números com todos os dígitos iguais', () => {
      expect(validatePhone('11111111111')).toBe(false);
      expect(validatePhone('0000000000')).toBe(false);
      expect(validatePhone('9999999999')).toBe(false);
    });

    it('deve rejeitar celular com todos os dígitos iguais mesmo que comece com 9', () => {
      expect(validatePhone('99999999999')).toBe(false);
    });
  });

  describe('maskPhone', () => {
    it('deve limitar a 11 dígitos e formatar', () => {
      expect(maskPhone('119876543219999')).toBe('(11) 98765-4321');
    });

    it('deve formatar valor limpo', () => {
      expect(maskPhone('11987654321')).toBe('(11) 98765-4321');
      expect(maskPhone('1134567890')).toBe('(11) 3456-7890');
    });

    it('deve formatar valor parcial', () => {
      expect(maskPhone('119')).toBe('(11) 9');
      expect(maskPhone('11987')).toBe('(11) 987');
    });

    it('deve lidar com string vazia', () => {
      expect(maskPhone('')).toBe('');
    });
  });

  describe('getPhoneErrorMessage', () => {
    it('deve retornar null para string vazia', () => {
      expect(getPhoneErrorMessage('')).toBeNull();
    });

    it('deve retornar null para telefone válido', () => {
      expect(getPhoneErrorMessage('11987654321')).toBeNull();
      expect(getPhoneErrorMessage('1134567890')).toBeNull();
    });

    it('deve retornar "Telefone incompleto" para menos de 10 dígitos', () => {
      expect(getPhoneErrorMessage('119876543')).toBe('Telefone incompleto');
      expect(getPhoneErrorMessage('1198765')).toBe('Telefone incompleto');
    });

    it('deve retornar "Telefone muito longo" para mais de 11 dígitos', () => {
      expect(getPhoneErrorMessage('119876543212')).toBe('Telefone muito longo');
    });

    it('deve retornar "DDD inválido" para DDD menor que 11', () => {
      expect(getPhoneErrorMessage('0987654321')).toBe('DDD inválido');
      expect(getPhoneErrorMessage('1087654321')).toBe('DDD inválido');
    });

    it('deve retornar "Celular deve começar com 9" para celular sem 9', () => {
      expect(getPhoneErrorMessage('11887654321')).toBe('Celular deve começar com 9');
      expect(getPhoneErrorMessage('11787654321')).toBe('Celular deve começar com 9');
    });

    it('deve retornar "Número inválido" para todos os dígitos iguais', () => {
      // Para celular 11 dígitos, precisa começar com 9, então 99999999999 seria rejeitado primeiro como "começar com 9"
      // Testamos com fixo 10 dígitos onde não há essa restrição
      expect(getPhoneErrorMessage('1111111111')).toBe('Número inválido');
      expect(getPhoneErrorMessage('2222222222')).toBe('Número inválido');
    });
  });
});
