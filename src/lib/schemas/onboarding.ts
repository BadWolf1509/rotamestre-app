import { z } from 'zod';

export const criarUnidadeSchema = z
  .object({
    gestorNome: z.string().trim().min(3, 'Informe seu nome completo'),
    unidadeNome: z.string().trim().min(2, 'Informe o nome da empresa'),
    cidade: z.string().trim().min(2, 'Informe a cidade'),
    uf: z
      .string()
      .trim()
      .length(2, 'UF deve ter 2 letras')
      .optional()
      .or(z.literal('')),
    endereco: z.string().trim().min(5, 'Informe o endereço da sede'),
    // Opcionais no tipo, obrigatórios na validação. Digitar no campo precisa
    // poder LIMPAR as coordenadas (só são confiáveis vindas de uma sugestão
    // selecionada), e `setValue(campo, undefined)` só é legal se o tipo aceitar.
    // Tipar como obrigatório aqui forçaria um cast na tela.
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    telefone: z.string().trim().optional(),
  })
  .refine((d) => d.latitude !== undefined && d.longitude !== undefined, {
    // Sem coordenadas a unidade nasce incapaz de gerar rota.
    message: 'Selecione o endereço na lista de sugestões',
    path: ['endereco'],
  });

export type CriarUnidadeInput = z.infer<typeof criarUnidadeSchema>;

/** Entrada da RPC: aqui as coordenadas já passaram pelo `.refine`. */
export type CriarUnidadeParams = Omit<
  CriarUnidadeInput,
  'latitude' | 'longitude'
> & { latitude: number; longitude: number };
