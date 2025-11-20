import { validation, formatTelefone } from '../validation';

describe('validation utils', () => {
  describe('email', () => {
    it('deve validar email correto', () => {
      expect(validation.email('teste@exemplo.com').valid).toBe(true);
    });

    it('deve invalidar email incorreto', () => {
      expect(validation.email('teste').valid).toBe(false);
      expect(validation.email('teste@').valid).toBe(false);
      expect(validation.email('').valid).toBe(false);
    });
  });

  describe('telefone', () => {
    it('deve validar telefone correto (celular)', () => {
      expect(validation.telefone('11987654321').valid).toBe(true);
    });

    it('deve validar telefone correto (fixo)', () => {
      expect(validation.telefone('1133334444').valid).toBe(true);
    });

    it('deve invalidar tamanho incorreto', () => {
      expect(validation.telefone('119876543').valid).toBe(false); // 9 digitos
    });

    it('deve invalidar DDD incorreto', () => {
      expect(validation.telefone('01987654321').valid).toBe(false);
    });

    it('deve aceitar vazio (opcional)', () => {
      expect(validation.telefone('').valid).toBe(true);
    });
  });

  describe('nome', () => {
    it('deve validar nome completo', () => {
      expect(validation.nome('João Silva').valid).toBe(true);
    });

    it('deve invalidar nome curto', () => {
      expect(validation.nome('Jo').valid).toBe(false);
    });

    it('deve invalidar nome sem sobrenome', () => {
      expect(validation.nome('João').valid).toBe(false);
    });
  });

  describe('senha', () => {
    it('deve validar senha correta', () => {
      expect(validation.senha('123456').valid).toBe(true);
    });

    it('deve invalidar senha curta', () => {
      expect(validation.senha('12345').valid).toBe(false);
    });
  });

  describe('formatTelefone', () => {
    it('deve formatar celular', () => {
      expect(formatTelefone('11987654321')).toBe('(11) 98765-4321');
    });

    it('deve formatar fixo', () => {
      expect(formatTelefone('1133334444')).toBe('(11) 3333-4444');
    });

    it('deve formatar parcial', () => {
      expect(formatTelefone('11')).toBe('11');
      expect(formatTelefone('119')).toBe('(11) 9');
    });
  });
});
