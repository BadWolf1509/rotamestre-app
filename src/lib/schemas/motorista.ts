/**
 * Motorista (Driver) Schema
 *
 * Zod schemas dos formulários de motorista do gestor: criar (com senha
 * inicial e e-mail) e editar (só nome e telefone — e-mail não se altera
 * pelo app, e a senha é do motorista).
 */

import { z } from 'zod';

import { optionalPhoneSchema } from '../phone';
import { emailSchema, passwordSchema, nomeSchema } from './basic';

/**
 * Criação de motorista. A senha segue o `passwordSchema` — a mesma regra do
 * cadastro do gestor; não existe regra própria de motorista.
 *
 * Telefone pelo `optionalPhoneSchema` (mesmas regras do `phoneSchema`, mas
 * aceita ""): o campo vazio do formulário chega como string vazia, e o
 * `phoneSchema.optional()` só aceitaria `undefined`.
 */
export const motoristaSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  telefone: optionalPhoneSchema,
  senha: passwordSchema,
});

export type MotoristaInput = z.infer<typeof motoristaSchema>;

/** Edição de motorista (lista e perfil): sem senha e sem e-mail. */
export const motoristaEdicaoSchema = motoristaSchema.omit({
  senha: true,
  email: true,
});
