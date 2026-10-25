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

// ============================================================================
// RESET PASSWORD
// ============================================================================

/**
 * Reset-password form schema
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ============================================================================
// TROCAR SENHA (logado: gestor e motorista)
// ============================================================================

/**
 * Troca de senha com a pessoa logada. A regra da NOVA senha é o
 * `passwordSchema` — a mesma do cadastro e da redefinição. Antes, a tela do
 * motorista aceitava 6 caracteres e a do gestor tinha uma regra própria.
 *
 * Os dois `refine` só rodam com todos os campos válidos (comportamento do Zod
 * em objeto): a mensagem de "não coincidem" aparece quando a senha já passou
 * na regra, igual ao cadastro.
 */
export const trocarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Digite sua senha atual'),
    novaSenha: passwordSchema,
    confirmarSenha: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  })
  .refine((data) => data.novaSenha !== data.senhaAtual, {
    message: 'A nova senha deve ser diferente da atual',
    path: ['novaSenha'],
  });

export type TrocarSenhaInput = z.infer<typeof trocarSenhaSchema>;
