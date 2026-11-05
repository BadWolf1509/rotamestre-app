/**
 * Motoristas com vínculo ATIVO numa loja: a consulta única que `useMotoristas`,
 * `useMotoristaSelection` e `ChangeDriverModal` repetiam à mão (três cópias que
 * já tinham divergido no tratamento de erro e na resposta velha).
 *
 * Quem chama continua dono do contador de requisição: a função só busca.
 */

import { supabase } from '@/lib/supabase';

export interface MotoristaDaLoja {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  ativo: boolean;
  /** `null` = nunca entrou no app (a seleção pede confirmação). */
  ultimo_login: string | null;
}

type Vinculacao = {
  usuario_id: string;
  usuarios: MotoristaDaLoja | null;
};

/**
 * Lança o erro do Supabase; devolve só usuários ativos, em ordem alfabética.
 * Usuário escondido pela RLS (embed `null`) fica de fora.
 */
export async function buscarMotoristasAtivosDaLoja(
  unidadeId: string,
): Promise<MotoristaDaLoja[]> {
  const { data, error } = await supabase
    .from('usuario_unidades')
    .select(
      `
      usuario_id,
      usuarios (id, nome, email, telefone, ativo, ultimo_login)
    `,
    )
    .eq('unidade_id', unidadeId)
    .eq('papel', 'motorista')
    .eq('ativo', true)
    .returns<Vinculacao[]>();

  if (error) throw error;

  return (data ?? [])
    .map((vinculo) => vinculo.usuarios)
    .filter((u): u is MotoristaDaLoja => u !== null && u.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}
