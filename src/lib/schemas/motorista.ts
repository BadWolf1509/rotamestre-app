/**
 * Motorista (Driver) Schema
 *
 * Zod schema for driver creation/editing.
 */

import { z } from 'zod';

import { phoneSchema } from '../phone';
import { emailSchema, passwordSchema, nomeSchema } from './basic';

/**
 * Driver creation schema
 */
export const motoristaSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  telefone: phoneSchema.optional(),
  senha: passwordSchema,
});

export type MotoristaInput = z.infer<typeof motoristaSchema>;
