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
  PASSWORD_SPECIAL_REGEX,
  // Schemas
  emailSchema,
  // Functions
  validatePassword,
} from './basic';

// Phone schemas (re-exported from phone module)

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
