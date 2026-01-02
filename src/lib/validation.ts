/**
 * Utilitários de validação centralizados
 *
 * Contém schemas Zod e funções de validação para uso em todo o app.
 * Garante consistência e segurança na validação de dados.
 */

import { z } from 'zod';

// ============================================================================
// CONSTANTES
// ============================================================================

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIREMENTS = {
  minLength: PASSWORD_MIN_LENGTH,
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: false, // Opcional por enquanto
};

// ============================================================================
// SCHEMAS DE VALIDAÇÃO
// ============================================================================

/**
 * Schema para validação de email
 */
export const emailSchema = z
  .string()
  .min(1, 'E-mail é obrigatório')
  .email('E-mail inválido')
  .toLowerCase()
  .trim();

/**
 * Schema para validação de senha forte
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
 * Schema para telefone brasileiro
 * Aceita formatos: (11) 99999-9999, 11999999999, etc
 */
export const telefoneSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, '')) // Remove não-dígitos
  .refine((val) => val.length >= 10 && val.length <= 11, {
    message: 'Telefone deve ter 10 ou 11 dígitos',
  })
  .refine((val) => /^[1-9]{2}/.test(val), {
    message: 'DDD inválido',
  });

/**
 * Schema para nome de pessoa
 */
export const nomeSchema = z
  .string()
  .min(3, 'Nome deve ter no mínimo 3 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres')
  .trim()
  .refine((val) => /^[a-zA-ZÀ-ÿ\s]+$/.test(val), {
    message: 'Nome deve conter apenas letras',
  });

/**
 * Schema para endereço
 */
export const enderecoSchema = z
  .string()
  .min(5, 'Endereço deve ter no mínimo 5 caracteres')
  .max(200, 'Endereço deve ter no máximo 200 caracteres')
  .trim();

/**
 * Schema para observações (opcional)
 */
export const observacoesSchema = z
  .string()
  .max(500, 'Observações deve ter no máximo 500 caracteres')
  .trim()
  .optional();

/**
 * Schema para coordenadas geográficas
 */
export const coordenadasSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// ============================================================================
// SCHEMAS COMPOSTOS
// ============================================================================

/**
 * Schema para parada de rota
 */
export const paradaSchema = z.object({
  endereco: enderecoSchema,
  tipo: z.enum(['entrega', 'retirada']),
  destinatario: z
    .string()
    .min(1, 'Nome do destinatário é obrigatório')
    .max(100, 'Nome muito longo')
    .trim(),
  telefone: telefoneSchema,
  observacoes: observacoesSchema,
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

/**
 * Schema para criação de motorista
 */
export const motoristaSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  telefone: telefoneSchema.optional(),
  senha: passwordSchema,
});

/**
 * Schema para login
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
});

/**
 * Schema para registro
 */
export const registerSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  tipo: z.enum(['gestor', 'motorista']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

// ============================================================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================================================

/**
 * Valida senha e retorna objeto com resultado
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

  // Calcular força
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

/**
 * Valida email de forma simples
 */
export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

/**
 * Valida telefone brasileiro
 */
export function isValidTelefone(telefone: string): boolean {
  return telefoneSchema.safeParse(telefone).success;
}

/**
 * Formata telefone para exibição
 */
export function formatTelefone(telefone: string): string {
  const digits = telefone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return telefone;
}

/**
 * Valida coordenadas geográficas
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ============================================================================
// TIPOS EXPORTADOS
// ============================================================================

export type ParadaInput = z.infer<typeof paradaSchema>;
export type MotoristaInput = z.infer<typeof motoristaSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
