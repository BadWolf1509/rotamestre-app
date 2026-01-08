/**
 * Basic Field Schemas
 *
 * Reusable Zod schemas for common field types.
 */

import { z } from 'zod';

// ============================================================================
// CONSTANTS
// ============================================================================

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIREMENTS = {
  minLength: PASSWORD_MIN_LENGTH,
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: false, // Optional for now
};

// ============================================================================
// EMAIL
// ============================================================================

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, 'E-mail é obrigatório')
  .email('E-mail inválido')
  .toLowerCase()
  .trim();

// ============================================================================
// PASSWORD
// ============================================================================

/**
 * Strong password validation schema
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Senha deve conter pelo menos uma letra maiúscula',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'Senha deve conter pelo menos um número',
  });

/**
 * Validate password and return result object
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Precisa de letra maiúscula');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Precisa de número');
  }

  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isLong = password.length >= 12;

  const score = [hasSpecial, hasLower, hasUpper, hasNumber, isLong].filter(Boolean).length;

  if (score >= 4) {
    strength = 'strong';
  } else if (score >= 3) {
    strength = 'medium';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

// ============================================================================
// NAME
// ============================================================================

/**
 * Person name validation schema
 */
export const nomeSchema = z
  .string()
  .min(3, 'Nome deve ter no mínimo 3 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres')
  .trim()
  .refine((val) => /^[a-zA-ZÀ-ÿ\s]+$/.test(val), {
    message: 'Nome deve conter apenas letras',
  });

// ============================================================================
// ADDRESS
// ============================================================================

/**
 * Address validation schema
 */
export const enderecoSchema = z
  .string()
  .min(5, 'Endereço deve ter no mínimo 5 caracteres')
  .max(200, 'Endereço deve ter no máximo 200 caracteres')
  .trim();

// ============================================================================
// NOTES/OBSERVATIONS
// ============================================================================

/**
 * Optional observations schema
 */
export const observacoesSchema = z
  .string()
  .max(500, 'Observações deve ter no máximo 500 caracteres')
  .trim()
  .optional();

// ============================================================================
// COORDINATES
// ============================================================================

/**
 * Geographic coordinates schema
 */
export const coordenadasSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Validate geographic coordinates
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Simple email validation
 */
export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}
