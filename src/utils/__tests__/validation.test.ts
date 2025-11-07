import { validation, formatTelefone } from '../validation';

describe('Validation Utils', () => {
  describe('validation.email', () => {
    it('deve validar emails corretos', () => {
      expect(validation.email('usuario@exemplo.com').valid).toBe(true);
      expect(validation.email('teste@dominio.com.br').valid).toBe(true);
      expect(validation.email('nome.sobrenome@empresa.com').valid).toBe(true);
      expect(validation.email('user+tag@email.co').valid).toBe(true);
    });

    it('deve rejeitar email vazio', () => {
      const result = validation.email('');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Email é obrigatório');
    });

    it('deve rejeitar email apenas com espaços', () => {
      const result = validation.email('   ');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Email é obrigatório');
    });

    it('deve rejeitar emails sem @', () => {
      const result = validation.email('usuarioexemplo.com');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Email inválido. Use o formato: exemplo@dominio.com');
    });

    it('deve rejeitar emails sem domínio', () => {
      const result = validation.email('usuario@');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Email inválido. Use o formato: exemplo@dominio.com');
    });

    it('deve rejeitar emails sem extensão', () => {
      const result = validation.email('usuario@dominio');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Email inválido. Use o formato: exemplo@dominio.com');
    });

    it('deve rejeitar emails com espaços', () => {
      const result = validation.email('usuario @exemplo.com');
      expect(result.valid).toBe(false);
    });

    it('deve aceitar email com espaços nas extremidades (trim)', () => {
      const result = validation.email('  usuario@exemplo.com  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('validation.telefone', () => {
    it('deve validar telefones fixos corretos (10 dígitos)', () => {
      expect(validation.telefone('(11) 1234-5678').valid).toBe(true);
      expect(validation.telefone('1112345678').valid).toBe(true);
      expect(validation.telefone('(21)9876-5432').valid).toBe(true);
    });

    it('deve validar telefones celulares corretos (11 dígitos)', () => {
      expect(validation.telefone('(11) 91234-5678').valid).toBe(true);
      expect(validation.telefone('11912345678').valid).toBe(true);
      expect(validation.telefone('(21) 99876-5432').valid).toBe(true);
    });

    it('deve aceitar telefone vazio (opcional)', () => {
      expect(validation.telefone('').valid).toBe(true);
      expect(validation.telefone('   ').valid).toBe(true);
    });

    it('deve rejeitar telefone com menos de 10 dígitos', () => {
      const result = validation.telefone('(11) 1234-567');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Telefone inválido. Use (XX) XXXX-XXXX ou (XX) XXXXX-XXXX');
    });

    it('deve rejeitar telefone com mais de 11 dígitos', () => {
      const result = validation.telefone('(11) 91234-56789');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Telefone inválido. Use (XX) XXXX-XXXX ou (XX) XXXXX-XXXX');
    });

    it('deve rejeitar DDD inválido (menor que 11)', () => {
      const result = validation.telefone('(10) 1234-5678');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('DDD inválido. Use um DDD válido entre 11 e 99');
    });

    it('deve rejeitar DDD inválido (maior que 99)', () => {
      const result = validation.telefone('(100) 1234-5678');
      expect(result.valid).toBe(false);
    });

    it('deve aceitar DDDs válidos', () => {
      expect(validation.telefone('(11) 1234-5678').valid).toBe(true); // SP
      expect(validation.telefone('(21) 1234-5678').valid).toBe(true); // RJ
      expect(validation.telefone('(85) 1234-5678').valid).toBe(true); // CE
      expect(validation.telefone('(99) 1234-5678').valid).toBe(true); // Último válido
    });

    it('deve remover caracteres não numéricos corretamente', () => {
      expect(validation.telefone('(11) 1234-5678').valid).toBe(true);
      expect(validation.telefone('11-1234-5678').valid).toBe(true);
      expect(validation.telefone('11.1234.5678').valid).toBe(true);
    });
  });

  describe('validation.nome', () => {
    it('deve validar nomes completos corretos', () => {
      expect(validation.nome('João Silva').valid).toBe(true);
      expect(validation.nome('Maria da Silva Santos').valid).toBe(true);
      expect(validation.nome('Ana Oliveira').valid).toBe(true);
    });

    it('deve rejeitar nome vazio', () => {
      const result = validation.nome('');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Nome é obrigatório');
    });

    it('deve rejeitar nome apenas com espaços', () => {
      const result = validation.nome('   ');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Nome é obrigatório');
    });

    it('deve rejeitar nome com menos de 3 caracteres', () => {
      const result = validation.nome('Jo');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Nome deve ter pelo menos 3 caracteres');
    });

    it('deve rejeitar nome sem sobrenome', () => {
      const result = validation.nome('João');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Digite o nome completo (nome e sobrenome)');
    });

    it('deve aceitar nome com inicial e sobrenome', () => {
      // "J Silva" tem 7 caracteres no total, então passa na validação
      const result = validation.nome('J Silva');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar nome com múltiplos espaços', () => {
      expect(validation.nome('João   Silva').valid).toBe(true);
    });

    it('deve aceitar nome com espaços nas extremidades (trim)', () => {
      expect(validation.nome('  João Silva  ').valid).toBe(true);
    });

    it('deve aceitar nomes compostos', () => {
      expect(validation.nome('José da Silva').valid).toBe(true);
      expect(validation.nome('Ana Maria de Souza').valid).toBe(true);
    });
  });

  describe('validation.senha', () => {
    it('deve validar senhas corretas (6+ caracteres)', () => {
      expect(validation.senha('123456').valid).toBe(true);
      expect(validation.senha('senha123').valid).toBe(true);
      expect(validation.senha('S3nh@F0rt3!').valid).toBe(true);
    });

    it('deve rejeitar senha vazia', () => {
      const result = validation.senha('');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Senha é obrigatória');
    });

    it('deve rejeitar senha apenas com espaços', () => {
      const result = validation.senha('   ');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Senha é obrigatória');
    });

    it('deve rejeitar senha com menos de 6 caracteres', () => {
      const result = validation.senha('12345');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Senha deve ter pelo menos 6 caracteres');
    });

    it('deve aceitar senha com exatamente 6 caracteres', () => {
      expect(validation.senha('abcdef').valid).toBe(true);
    });

    it('deve aceitar senhas longas', () => {
      expect(validation.senha('senha_muito_longa_123456789').valid).toBe(true);
    });
  });

  describe('formatTelefone', () => {
    it('deve retornar vazio para string vazia', () => {
      expect(formatTelefone('')).toBe('');
    });

    it('deve formatar DDD apenas (1-2 dígitos)', () => {
      expect(formatTelefone('1')).toBe('1');
      expect(formatTelefone('11')).toBe('11');
    });

    it('deve formatar DDD + início do número (3-6 dígitos)', () => {
      expect(formatTelefone('111')).toBe('(11) 1');
      expect(formatTelefone('1112')).toBe('(11) 12');
      expect(formatTelefone('11123')).toBe('(11) 123');
      expect(formatTelefone('111234')).toBe('(11) 1234');
    });

    it('deve formatar telefone fixo (7-10 dígitos)', () => {
      expect(formatTelefone('1112345')).toBe('(11) 1234-5');
      expect(formatTelefone('11123456')).toBe('(11) 1234-56');
      expect(formatTelefone('111234567')).toBe('(11) 1234-567');
      expect(formatTelefone('1112345678')).toBe('(11) 1234-5678');
    });

    it('deve formatar telefone celular (11 dígitos)', () => {
      expect(formatTelefone('11912345678')).toBe('(11) 91234-5678');
    });

    it('deve truncar números extras (mais de 11 dígitos)', () => {
      expect(formatTelefone('119123456789')).toBe('(11) 91234-5678');
      expect(formatTelefone('1191234567890')).toBe('(11) 91234-5678');
    });

    it('deve remover caracteres não numéricos', () => {
      expect(formatTelefone('(11) 91234-5678')).toBe('(11) 91234-5678');
      expect(formatTelefone('11-91234-5678')).toBe('(11) 91234-5678');
      expect(formatTelefone('11.91234.5678')).toBe('(11) 91234-5678');
      expect(formatTelefone('11 91234 5678')).toBe('(11) 91234-5678');
    });

    it('deve remover letras e caracteres especiais', () => {
      expect(formatTelefone('abc11def91234ghij5678')).toBe('(11) 91234-5678');
      expect(formatTelefone('11@91234#5678')).toBe('(11) 91234-5678');
    });

    it('deve formatar enquanto digita (casos reais)', () => {
      expect(formatTelefone('1')).toBe('1');
      expect(formatTelefone('11')).toBe('11');
      expect(formatTelefone('119')).toBe('(11) 9');
      expect(formatTelefone('1191')).toBe('(11) 91');
      expect(formatTelefone('11912')).toBe('(11) 912');
      expect(formatTelefone('119123')).toBe('(11) 9123');
      expect(formatTelefone('1191234')).toBe('(11) 9123-4');
      expect(formatTelefone('11912345')).toBe('(11) 9123-45'); // Formato fixo até 10 dígitos
      expect(formatTelefone('119123456')).toBe('(11) 9123-456');
      expect(formatTelefone('1191234567')).toBe('(11) 9123-4567');
      expect(formatTelefone('11912345678')).toBe('(11) 91234-5678'); // Formato celular com 11 dígitos
    });
  });

  describe('Integração: validation + formatTelefone', () => {
    it('deve validar telefone formatado', () => {
      const formatted = formatTelefone('11912345678');
      expect(validation.telefone(formatted).valid).toBe(true);
    });

    it('deve validar telefone fixo formatado', () => {
      const formatted = formatTelefone('1112345678');
      expect(validation.telefone(formatted).valid).toBe(true);
    });

    it('telefone parcialmente digitado não deve validar', () => {
      const formatted = formatTelefone('11912');
      const result = validation.telefone(formatted);
      expect(result.valid).toBe(false);
    });
  });
});
