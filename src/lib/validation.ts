/**
 * Validation Utilities - Barrel Export
 *
 * Re-exports from @/lib/schemas for backwards compatibility.
 * Prefer importing directly from @/lib/schemas.
 *
 * @deprecated Import from @/lib/schemas instead
 */

// Re-export everything from schemas
export * from './schemas';

// Re-export phone utilities for backwards compatibility
export {
  phoneSchema,
  telefoneSchema,
  formatPhone,
  formatTelefone,
  validatePhone,
  isValidTelefone,
} from './phone';
