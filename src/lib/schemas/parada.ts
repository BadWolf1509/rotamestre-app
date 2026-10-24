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

/**
 * Formulário dos modais de adicionar e editar parada de uma rota existente.
 *
 * Difere do da Nova Entrega (`paradaSchema` de useNovaEntrega) de propósito:
 * - destinatário e telefone são opcionais, como os modais sempre foram — exigir
 *   travaria a edição de parada antiga sem esses campos. Telefone preenchido
 *   tem de ter DDD e 10 ou 11 dígitos;
 * - coordenadas NÃO são exigidas aqui. O salvar geocodifica o endereço digitado
 *   (Photon) e, se falhar, pendura o erro em `endereco` com setError; quem
 *   limpa é `clearErrors('endereco')` ao escolher uma sugestão (erro cruzado:
 *   a causa é lat/long, a mensagem mora em endereço);
 * - sem transform no telefone: a máscara digitada chega intacta ao banco.
 */
export const paradaModalSchema = z.object({
  endereco: z.string().trim().min(5, 'Informe um endereço válido.'),
  tipo: z.enum(['entrega', 'retirada']),
  destinatario: z.string().trim().optional(),
  telefone: z
    .string()
    .optional()
    .refine((valor) => {
      const digitos = (valor ?? '').replace(/\D/g, '');
      return (
        digitos.length === 0 || digitos.length === 10 || digitos.length === 11
      );
    }, 'Telefone deve ter DDD e 10 ou 11 dígitos.'),
  observacoes: z
    .string()
    .max(300, 'As observações devem ter no máximo 300 caracteres.')
    .optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type ParadaModalFormData = z.infer<typeof paradaModalSchema>;
