/**
 * Utilitários para validação e formatação de telefone brasileiro
 */

/**
 * Remove caracteres não numéricos
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Formata telefone brasileiro (00) 00000-0000 ou (00) 0000-0000
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';

  const cleaned = cleanPhone(phone);

  // Celular: (00) 00000-0000
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  // Fixo: (00) 0000-0000
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  // Formatação parcial durante digitação
  if (cleaned.length > 6) {
    if (cleaned.length <= 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else {
      return cleaned.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    }
  } else if (cleaned.length > 2) {
    return cleaned.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  } else if (cleaned.length > 0) {
    return `(${cleaned}`;
  }

  return cleaned;
}

/**
 * Valida se telefone brasileiro é válido
 * Aceita fixo (10 dígitos) ou celular (11 dígitos)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;

  const cleaned = cleanPhone(phone);

  // Deve ter 10 (fixo) ou 11 (celular) dígitos
  if (cleaned.length !== 10 && cleaned.length !== 11) {
    return false;
  }

  // DDD deve ser entre 11 e 99
  const ddd = parseInt(cleaned.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return false;
  }

  // Celular: deve começar com 9
  if (cleaned.length === 11) {
    const ninthDigit = cleaned[2];
    if (ninthDigit !== '9') {
      return false;
    }
  }

  // Não aceitar números repetidos
  const allSame = cleaned.split('').every(digit => digit === cleaned[0]);
  if (allSame) {
    return false;
  }

  return true;
}

/**
 * Máscara de telefone para TextInput
 * Limita a 15 caracteres: (00) 00000-0000
 */
export function maskPhone(value: string): string {
  const cleaned = cleanPhone(value);
  const limited = cleaned.substring(0, 11); // Máximo 11 dígitos
  return formatPhone(limited);
}

/**
 * Retorna mensagem de erro de validação
 */
export function getPhoneErrorMessage(phone: string): string | null {
  if (!phone) return null;

  const cleaned = cleanPhone(phone);

  if (cleaned.length < 10) {
    return 'Telefone incompleto';
  }

  if (cleaned.length > 11) {
    return 'Telefone muito longo';
  }

  const ddd = parseInt(cleaned.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return 'DDD inválido';
  }

  if (cleaned.length === 11 && cleaned[2] !== '9') {
    return 'Celular deve começar com 9';
  }

  const allSame = cleaned.split('').every(digit => digit === cleaned[0]);
  if (allSame) {
    return 'Número inválido';
  }

  return null;
}
