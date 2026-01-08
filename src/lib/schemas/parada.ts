/**
 * Parada (Stop) Schema
 *
 * Zod schema for route stop validation.
 */

import { z } from 'zod';

import { phoneSchema } from '../phone';
import { enderecoSchema, observacoesSchema } from './basic';

/**
 * Route stop schema
 */
export const paradaSchema = z.object({
  endereco: enderecoSchema,
  tipo: z.enum(['entrega', 'retirada']),
  destinatario: z
    .string()
    .min(1, 'Nome do destinatário é obrigatório')
    .max(100, 'Nome muito longo')
    .trim(),
  telefone: phoneSchema,
  observacoes: observacoesSchema,
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type ParadaInput = z.infer<typeof paradaSchema>;
