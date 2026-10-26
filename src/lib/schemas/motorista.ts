/**
 * Motorista (Driver) Schema
 *
 * Zod schemas dos formulários de motorista do gestor: criar (com senha
 * inicial e e-mail) e editar (só nome e telefone — e-mail não se altera
 * pelo app, e a senha é do motorista).
 */

import { z } from 'zod';

import { optionalPhoneSchema } from '../phone';
import { emailSchema, passwordSchema } from './basic';

/**
 * Nome do motorista: regra própria, mais larga que o `nomeSchema` do
 * cadastro do gestor (só letras), que fica intocado. Motorista já cadastrado
 * tem nome com parênteses ("Carlos (Moto)"); com a regra do gestor, a edição
 * dele seria recusada mesmo trocando só o telefone. Aceita letras Unicode,
 * dígitos, espaço e ( ) ' . - ; o trim vem antes da medida.
 */
export const nomeMotoristaSchema = z
  .string()
  .trim()
  .min(3, 'Nome deve ter no mínimo 3 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres')
  .regex(/^[\p{L}\p{M}\d\s()'.-]+$/u, {
    message: "Nome aceita letras, números, espaço e ( ) ' . -",
  });

/**
 * Criação de motorista. A senha segue o `passwordSchema` — a mesma regra do
 * cadastro do gestor; não existe regra própria de motorista.
 *
 * Telefone pelo `optionalPhoneSchema` (mesmas regras do `phoneSchema`, mas
 * aceita ""): o campo vazio do formulário chega como string vazia, e o
 * `phoneSchema.optional()` só aceitaria `undefined`.
 */
export const motoristaSchema = z.object({
  nome: nomeMotoristaSchema,
  email: emailSchema,
  telefone: optionalPhoneSchema,
  // Espaço nas pontas é invisível no campo de senha: o gestor repassaria a
  // senha sem ele e o motorista não entraria. Recusar em vez de aparar
  // (`.trim()`), para a senha gravada ser exatamente a que o gestor viu.
  senha: passwordSchema.refine(
    (v) => v === v.trim(),
    'A senha não pode começar nem terminar com espaço',
  ),
});

export type MotoristaInput = z.infer<typeof motoristaSchema>;

/** Edição de motorista (lista e perfil): sem senha e sem e-mail. */
export const motoristaEdicaoSchema = motoristaSchema.omit({
  senha: true,
  email: true,
});
