import { z } from 'zod';

import { ehSiglaDeUF } from '../estados';
import { phoneSchema } from '../phone';

/**
 * Ficha da loja em Minha Unidade (`app/unidade/index.tsx`).
 *
 * Só o nome é obrigatório; os demais podem ficar vazios, mas, preenchidos,
 * têm de ser válidos. Sem transformações de propósito: entrada e saída têm o
 * mesmo tipo, então o form não precisa de tipos separados, e a tela segue
 * mandando à RPC o mesmo formato de antes (CEP com máscara, telefone limpo
 * pelo `cleanPhone`).
 *
 * A sede fica fora: ela depende das coordenadas da sugestão escolhida e tem
 * trava própria na tela (`sedePrecisaConfirmacao`).
 */
export const unidadeSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Informe o nome da unidade')
    .max(255, 'Nome deve ter no máximo 255 caracteres'),
  // Reaproveita as regras e as mensagens do `phoneSchema`, só deixando o
  // campo vazio passar. `optionalPhoneSchema` faria o mesmo, mas transforma o
  // valor em dígitos e duplica as regras em vez de usar o schema de referência.
  telefone: z.string().superRefine((valor, ctx) => {
    if (!valor.replace(/\D/g, '')) return;
    const resultado = phoneSchema.safeParse(valor);
    if (!resultado.success) {
      ctx.addIssue({
        code: 'custom',
        message: resultado.error.issues[0]?.message ?? 'Telefone inválido',
      });
    }
  }),
  endereco: z.string(),
  cidade: z.string().max(100, 'Cidade deve ter no máximo 100 caracteres'),
  estado: z
    .string()
    .refine((valor) => !valor.trim() || ehSiglaDeUF(valor), 'UF inválida'),
  cep: z.string().refine((valor) => {
    const digitos = valor.replace(/\D/g, '');
    return digitos.length === 0 || digitos.length === 8;
  }, 'CEP deve ter 8 dígitos'),
});

export type UnidadeFormInput = z.infer<typeof unidadeSchema>;
