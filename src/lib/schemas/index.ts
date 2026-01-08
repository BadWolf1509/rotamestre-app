/**
 * Zod Schemas - Barrel Export
 *
 * Centralized validation schemas for the RotaMestre app.
 *
 * Usage:
 * ```typescript
 * import { loginSchema, paradaSchema, type LoginInput } from '@/lib/schemas';
 * ```
 */

// Basic field schemas
export {
  // Constants
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  // Schemas
  emailSchema,
  passwordSchema,
  nomeSchema,
  enderecoSchema,
  observacoesSchema,
  coordenadasSchema,
  // Functions
  validatePassword,
  isValidCoordinates,
  isValidEmail,
} from './basic';

// Phone schemas (re-exported from phone module)
export { phoneSchema, optionalPhoneSchema, telefoneSchema } from '../phone';

// Auth schemas
export { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './auth';

// Domain schemas
export { paradaSchema, type ParadaInput } from './parada';
export { motoristaSchema, type MotoristaInput } from './motorista';
