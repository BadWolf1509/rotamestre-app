/**
 * Authentication Schemas
 *
 * Zod schemas for login and registration forms.
 */

import { z } from 'zod';

import { emailSchema, passwordSchema, nomeSchema } from './basic';

// ============================================================================
// LOGIN
// ============================================================================

/**
 * Login form schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// REGISTER
// ============================================================================

/**
 * Registration form schema
 */
export const registerSchema = z
  .object({
    nome: nomeSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    tipo: z.enum(['gestor', 'motorista']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ============================================================================
// FORGOT PASSWORD
// ============================================================================

/**
 * Forgot-password form schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
