import { useCallback, useState } from 'react';

import { logger } from '@/lib/logger';
import type { CriarUnidadeParams } from '@/lib/schemas/onboarding';
import { supabase } from '@/lib/supabase';

/**
 * Sentinela devolvida pela RPC quando o usuário já tem perfil. Reconhecemos por
 * ela, e não por texto livre: comparar a mensagem quebraria na primeira
 * mudança de redação.
 */
const PERFIL_JA_EXISTE = 'PERFIL_JA_EXISTE';

export function useCriarUnidade() {
  const [loading, setLoading] = useState(false);

  const criarUnidade = useCallback(async (input: CriarUnidadeParams) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('criar_unidade_para_novo_gestor', {
        p_gestor_nome: input.gestorNome,
        p_unidade_nome: input.unidadeNome,
        p_cidade: input.cidade,
        p_uf: input.uf || null,
        p_sede_endereco: input.endereco,
        p_sede_latitude: input.latitude,
        p_sede_longitude: input.longitude,
      });

      if (error) {
        // Já existe perfil: o estado desejado já está no banco. Tratar como
        // sucesso é o que torna duplo submit inofensivo.
        if (error.message?.includes(PERFIL_JA_EXISTE)) {
          return { ok: true as const };
        }
        // `error`, não `warn`: warn é __DEV__-only e sumiria em produção,
        // justamente onde precisamos saber que um onboarding falhou.
        logger.error('[useCriarUnidade] Falha ao criar unidade', error);
        throw error;
      }

      return { ok: true as const };
    } finally {
      setLoading(false);
    }
  }, []);

  return { criarUnidade, loading };
}
