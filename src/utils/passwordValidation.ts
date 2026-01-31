/**
 * Password Validation Utilities
 *
 * Provides password strength validation with visual feedback.
 * Used in registration and password change flows.
 *
 * Scoring System (0-6 points):
 * - +1: 8+ characters (minimum required)
 * - +1: 12+ characters (bonus for length)
 * - +1: Contains uppercase letter
 * - +1: Contains lowercase letter
 * - +1: Contains number
 * - +1: Contains special character
 *
 * Validation Threshold:
 * - score >= 5 required for valid password
 * - This ensures: 8+ chars, uppercase, lowercase, number, AND special char
 *
 * @see src/lib/schemas/basic.ts for Zod schema version
 */

import { defaultTheme } from '@/utils/styles';

/**
 * Password strength result with visual feedback
 */
export interface PasswordStrength {
  /** Strength score (0-6 points) */
  score: number;
  /** Human-readable strength label in Portuguese */
  label: 'Muito Fraca' | 'Fraca' | 'Regular' | 'Boa' | 'Forte' | 'Muito Forte';
  /** Color for visual indicator (from theme) */
  color: string;
  /** List of missing requirements (empty if all met) */
  feedback: string[];
}

/**
 * Validates password strength and returns detailed feedback.
 *
 * @param password - The password to validate
 * @returns PasswordStrength object with score, label, color, and feedback
 *
 * @example
 * ```ts
 * const result = validatePasswordStrength('Senha123!');
 * // { score: 5, label: 'Forte', color: '(theme color)', feedback: [] }
 * ```
 */
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

/**
 * Checks if a password meets minimum security requirements.
 *
 * Requires score >= 5, which means the password must have:
 * - 8+ characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * @param password - The password to validate
 * @returns true if password meets requirements, false otherwise
 *
 * @example
 * ```ts
 * isPasswordValid('abc123');     // false - missing uppercase, special
 * isPasswordValid('Abc12345');   // false - missing special character
 * isPasswordValid('Senha123!');  // true - meets all requirements
 * ```
 */
export function isPasswordValid(password: string): boolean {
  return validatePasswordStrength(password).score >= 5;
}
