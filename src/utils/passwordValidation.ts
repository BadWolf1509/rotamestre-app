import { defaultTheme } from '@/utils/styles';

export interface PasswordStrength {
  score: number; // 0-5
  label: 'Muito Fraca' | 'Fraca' | 'Regular' | 'Boa' | 'Forte' | 'Muito Forte';
  color: string;
  feedback: string[];
}

export function validatePasswordStrength(password: string): PasswordStrength {
  let score = 0;
  const feedback: string[] = [];

  // Critério 1: Comprimento
  if (password.length >= 8) {
    score++;
  } else {
    feedback.push('Mínimo 8 caracteres');
  }

  if (password.length >= 12) score++;

  // Critério 2: Maiúsculas
  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('Pelo menos 1 maiúscula');
  }

  // Critério 3: Minúsculas
  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push('Pelo menos 1 minúscula');
  }

  // Critério 4: Números
  if (/[0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('Pelo menos 1 número');
  }

  // Critério 5: Caracteres especiais
  if (/[^A-Za-z0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('Pelo menos 1 caractere especial (!@#$%&*)');
  }

  // Determinar label e cor
  let label: PasswordStrength['label'];
  let color: string;

  const { colors } = defaultTheme;

  if (score <= 1) {
    label = 'Muito Fraca';
    color = colors.error;
  } else if (score === 2) {
    label = 'Fraca';
    color = colors.warning;
  } else if (score === 3) {
    label = 'Regular';
    color = colors.secondary;
  } else if (score === 4) {
    label = 'Boa';
    color = colors.success;
  } else if (score === 5) {
    label = 'Forte';
    color = colors.primary;
  } else {
    label = 'Muito Forte';
    color = colors.primaryDark;
  }

  return { score, label, color, feedback };
}

export function isPasswordValid(password: string): boolean {
  return validatePasswordStrength(password).score >= 4;
}
