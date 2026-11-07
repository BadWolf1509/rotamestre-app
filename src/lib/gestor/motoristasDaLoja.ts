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

export interface OpcoesMotoristasDaLoja {
  /**
   * Para FILTRAR rotas (Início, Gestão): quem teve a conta desativada ainda tem
   * rotas antigas, então basta o vínculo ativo. Para ATRIBUIR motorista a uma
   * rota (padrão), exige também o cadastro ativo.
   */
  incluirCadastroInativo?: boolean;
}

/**
 * Lança o erro do Supabase; devolve em ordem alfabética. Por padrão só
 * usuários com cadastro ativo (atribuição). Usuário escondido pela RLS (embed
 * `null`) fica de fora.
 */
export async function buscarMotoristasAtivosDaLoja(
  unidadeId: string,
  { incluirCadastroInativo = false }: OpcoesMotoristasDaLoja = {},
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
    .filter(
      (u): u is MotoristaDaLoja =>
        u !== null && (incluirCadastroInativo || u.ativo),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome));
}
