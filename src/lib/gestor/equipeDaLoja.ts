/**
 * Equipe de uma loja — fonte ÚNICA da tela Equipe (`app/unidade/equipe.tsx`)
 * e do número "Membros da Equipe" da Minha Unidade (`app/unidade/index.tsx`).
 * Antes cada tela contava de um jeito (a Minha Unidade só vínculo ativo; a
 * Equipe também o motorista inativo nesta loja), e os números divergiam.
 *
 * - Motoristas: `listar_motoristas_unidade` (inclui quem está inativo só
 *   nesta loja, para reativar; `ativo` já é vínculo E pessoa ativos).
 * - Gestores: vínculo ativo em `usuario_unidades`.
 */
import { supabase } from '@/lib/supabase';

export interface MembroDaEquipe {
  id: string;
  nome: string;
  email: string;
  papel: 'gestor' | 'motorista';
  /** Principal DESTA loja (ver `ehGestorPrincipalDaLoja`). */
  is_gestor_principal: boolean;
  ativo: boolean;
  created_at: string;
  foto_url: string | null;
}

/**
 * Gestor principal da loja `unidadeId`.
 *
 * O flag `usuarios.is_gestor_principal` é um booleano só, mas vale no "slot"
 * de `usuarios.unidade_id`: o índice único é por essa coluna, e
 * `transferir_gestao_principal` só aceita quem tem o flag E `unidade_id` =
 * a loja. Ler o flag sozinho dava ao principal da loja A as ações de
 * principal na loja B ao trocar de loja.
 *
 * POR QUE NÃO `usuario_unidades.is_principal`, que é por loja: a transferência
 * não o atualiza, e ele diverge do flag (medido em 23/10/2026: 7 vínculos de
 * gestor com `is_principal`, 1 usuário com o flag). Mostrar o botão por ele
 * ofereceria a 6 gestores uma transferência que a RPC recusa.
 */
export function ehGestorPrincipalDaLoja(
  usuario:
    | { is_gestor_principal?: boolean | null; unidade_id?: string | null }
    | null
    | undefined,
  unidadeId: string | null | undefined,
): boolean {
  return (
    !!unidadeId &&
    usuario?.is_gestor_principal === true &&
    usuario.unidade_id === unidadeId
  );
}

type LinhaMotorista = Omit<MembroDaEquipe, 'papel' | 'is_gestor_principal'>;
type LinhaGestor = Omit<MembroDaEquipe, 'is_gestor_principal'> & {
  is_gestor_principal: boolean | null;
  unidade_id: string | null;
};

/** Membros da loja; lança se qualquer das duas consultas falhar. */
export async function carregarEquipeDaLoja(
  unidadeId: string,
): Promise<MembroDaEquipe[]> {
  const [motoristasRes, gestoresRes] = await Promise.all([
    supabase.rpc('listar_motoristas_unidade', { p_unidade_id: unidadeId }),
    supabase
      .from('usuario_unidades')
      .select(
        'usuarios(id, nome, email, papel, is_gestor_principal, unidade_id, ativo, created_at, foto_url)',
      )
      .eq('unidade_id', unidadeId)
      .eq('papel', 'gestor')
      .eq('ativo', true),
  ]);

  if (motoristasRes.error) throw motoristasRes.error;
  if (gestoresRes.error) throw gestoresRes.error;

  const motoristas: MembroDaEquipe[] = (
    (motoristasRes.data ?? []) as LinhaMotorista[]
  ).map((m) => ({
    id: m.id,
    nome: m.nome,
    email: m.email,
    papel: 'motorista',
    is_gestor_principal: false,
    ativo: m.ativo,
    created_at: m.created_at,
    foto_url: m.foto_url,
  }));
  // A relação embutida vem como objeto (FK para uma linha só).
  const gestores: MembroDaEquipe[] = (
    (gestoresRes.data ?? []) as unknown as { usuarios: LinhaGestor | null }[]
  )
    .map((v) => v.usuarios)
    .filter((u): u is LinhaGestor => !!u)
    .map(({ unidade_id: _unidade, ...u }) => ({
      ...u,
      is_gestor_principal: ehGestorPrincipalDaLoja(
        { is_gestor_principal: u.is_gestor_principal, unidade_id: _unidade },
        unidadeId,
      ),
    }));

  return [...gestores, ...motoristas].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

/** O que cada número da equipe conta — o mesmo nas duas telas. */
export function resumoDaEquipe(membros: readonly { ativo: boolean }[]): {
  total: number;
  ativos: number;
  inativos: number;
} {
  const ativos = membros.filter((m) => m.ativo).length;
  return { total: membros.length, ativos, inativos: membros.length - ativos };
}
