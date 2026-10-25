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
  PASSWORD_SPECIAL_REGEX,
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
export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  trocarSenhaSchema,
  type LoginInput,
  type RegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type TrocarSenhaInput,
} from './auth';

// Domain schemas
export {
  paradaSchema,
  paradaModalSchema,
  type ParadaInput,
  type ParadaModalFormData,
} from './parada';
export { motoristaSchema, type MotoristaInput } from './motorista';
