/**
 * Zod Schemas - Barrel Export
 *
 * Centralized validation schemas for the RotaMestre app.
 *
 * Usage:
 * ```typescript
 * import { loginSchema, type LoginInput } from '@/lib/schemas';
 * ```
 *
 * Os schemas de campo, telefone, parada e motorista vêm do próprio arquivo
 * (`./basic`, `./phone`, `./parada`, `./motorista`): ninguém os importava por
 * aqui, e a reexportação saiu na faxina de 13/11/2026.
 */

// Basic field constants
export { PASSWORD_MIN_LENGTH, PASSWORD_SPECIAL_REGEX } from './basic';

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
