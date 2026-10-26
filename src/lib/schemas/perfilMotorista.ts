/**
 * Schema do formulário "Editar perfil" do motorista.
 *
 * As regras são as que a tela já aplicava à mão: nome obrigatório (sem a
 * regra de só-letras do `nomeSchema`, que recusaria nomes que hoje salvam) e
 * telefone opcional no formato mascarado (11) 99999-9999 / (11) 9999-9999.
 */

import { z } from 'zod';

const TELEFONE_MASCARADO = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;

export const perfilMotoristaSchema = z.object({
  nome: z.string().trim().min(1, 'O nome é obrigatório.').max(100),
  telefone: z
    .string()
    .refine((valor) => valor === '' || TELEFONE_MASCARADO.test(valor), {
      message: 'Use o formato (11) 99999-9999.',
    }),
});

export type PerfilMotoristaInput = z.infer<typeof perfilMotoristaSchema>;
