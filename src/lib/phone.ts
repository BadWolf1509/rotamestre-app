/**
 * Phone Utilities - Consolidated Module
 *
 * All phone validation, formatting, and masking utilities for Brazilian phone numbers.
 * Single source of truth for phone-related operations across the app.
 */

import { z } from 'zod';

// ============================================================================
// CORE UTILITIES
// ============================================================================

/**
 * Remove all non-digit characters from phone string
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Format Brazilian phone number: (00) 00000-0000 or (00) 0000-0000
 * Handles partial input for real-time formatting during typing
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

  // Partial formatting during typing
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
 * Validate Brazilian phone number
 * Accepts landline (10 digits) or mobile (11 digits)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;

  const cleaned = cleanPhone(phone);

  // Must have 10 (landline) or 11 (mobile) digits
  if (cleaned.length !== 10 && cleaned.length !== 11) {
    return false;
  }

  // DDD must be between 11 and 99
  const ddd = parseInt(cleaned.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return false;
  }

  // Mobile: must start with 9
  if (cleaned.length === 11) {
    const ninthDigit = cleaned[2];
    if (ninthDigit !== '9') {
      return false;
    }
  }

  // Don't accept repeated digits (e.g., 11111111111)
  const allSame = cleaned.split('').every((digit) => digit === cleaned[0]);
  if (allSame) {
    return false;
  }

  return true;
}

/**
 * Phone mask for TextInput
 * Limits to 15 characters: (00) 00000-0000
 */
export function maskPhone(value: string): string {
  const cleaned = cleanPhone(value);
  const limited = cleaned.substring(0, 11); // Max 11 digits
  return formatPhone(limited);
}

/**
 * Get validation error message for phone
 * Returns null if valid
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

  const allSame = cleaned.split('').every((digit) => digit === cleaned[0]);
  if (allSame) {
    return 'Número inválido';
  }

  return null;
}

// ============================================================================
// ZOD SCHEMA
// ============================================================================

/**
 * Zod schema for Brazilian phone validation
 * Accepts formats: (11) 99999-9999, 11999999999, etc.
 */
export const phoneSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, '')) // Remove non-digits
  .refine((val) => val.length >= 10 && val.length <= 11, {
    message: 'Telefone deve ter 10 ou 11 dígitos',
  })
  .refine((val) => /^[1-9]{2}/.test(val), {
    message: 'DDD inválido',
  });

/**
 * Optional phone schema (allows empty string)
 */
export const optionalPhoneSchema = z
  .string()
  .optional()
  .transform((val) => (val ? val.replace(/\D/g, '') : ''))
  .refine((val) => !val || (val.length >= 10 && val.length <= 11), {
    message: 'Telefone deve ter 10 ou 11 dígitos',
  })
  .refine((val) => !val || /^[1-9]{2}/.test(val), {
    message: 'DDD inválido',
  });

// ============================================================================
// LEGACY ALIASES (for backwards compatibility)
// ============================================================================

/** @deprecated Use phoneSchema instead */
export const telefoneSchema = phoneSchema;

/** @deprecated Use validatePhone instead */
export const isValidTelefone = validatePhone;

/** @deprecated Use formatPhone instead */
export const formatTelefone = formatPhone;
