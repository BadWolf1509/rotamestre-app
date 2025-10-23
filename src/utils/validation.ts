export const validation = {
  email: (email: string): { valid: boolean; message?: string } => {
    if (!email || !email.trim()) {
      return { valid: false, message: 'Email é obrigatório' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { valid: false, message: 'Email inválido. Use o formato: exemplo@dominio.com' };
    }

    return { valid: true };
  },

  telefone: (telefone: string): { valid: boolean; message?: string } => {
    if (!telefone || !telefone.trim()) {
      return { valid: true }; // Telefone é opcional
    }

    // Remove tudo que não é número
    const numeros = telefone.replace(/\D/g, '');

    // Aceita 10 dígitos (fixo) ou 11 dígitos (celular)
    if (numeros.length !== 10 && numeros.length !== 11) {
      return {
        valid: false,
        message: 'Telefone inválido. Use (XX) XXXX-XXXX ou (XX) XXXXX-XXXX',
      };
    }

    // Validar DDD (deve ser entre 11 e 99)
    const ddd = parseInt(numeros.substring(0, 2));
    if (ddd < 11 || ddd > 99) {
      return {
        valid: false,
        message: 'DDD inválido. Use um DDD válido entre 11 e 99',
      };
    }

    return { valid: true };
  },

  nome: (nome: string): { valid: boolean; message?: string } => {
    if (!nome || !nome.trim()) {
      return { valid: false, message: 'Nome é obrigatório' };
    }

    if (nome.trim().length < 3) {
      return { valid: false, message: 'Nome deve ter pelo menos 3 caracteres' };
    }

    // Verifica se tem pelo menos nome e sobrenome
    const palavras = nome.trim().split(' ').filter((p) => p.length > 0);
    if (palavras.length < 2) {
      return { valid: false, message: 'Digite o nome completo (nome e sobrenome)' };
    }

    return { valid: true };
  },

  senha: (senha: string): { valid: boolean; message?: string } => {
    if (!senha || !senha.trim()) {
      return { valid: false, message: 'Senha é obrigatória' };
    }

    if (senha.length < 6) {
      return { valid: false, message: 'Senha deve ter pelo menos 6 caracteres' };
    }

    return { valid: true };
  },
};

// Função para formatar telefone enquanto digita
export const formatTelefone = (valor: string): string => {
  // Remove tudo que não é número
  const numeros = valor.replace(/\D/g, '');

  // Formata conforme o tamanho
  if (numeros.length <= 2) {
    return numeros;
  } else if (numeros.length <= 6) {
    // (XX) XXXX
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  } else if (numeros.length <= 10) {
    // (XX) XXXX-XXXX
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  } else {
    // (XX) XXXXX-XXXX
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
  }
};
