/**
 * Hook para gerenciar seleção de motoristas
 * Carrega lista de motoristas da unidade ativa
 */

import { useState, useCallback, useEffect } from 'react';

import type { MotoristaResumo, VinculacaoMotorista } from '@/components/gestor/nova-entrega/types';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface UseMotoristaSelectionReturn {
  motoristas: MotoristaResumo[];
  motoristaSelecionado: string;
  setMotoristaSelecionado: (id: string) => void;
  isLoading: boolean;
  reload: () => Promise<void>;
}

export function useMotoristaSelection(
  onError?: (message: string) => void
): UseMotoristaSelectionReturn {
  const { unidadeAtiva } = useUnidadeAtiva();

  const [motoristas, setMotoristas] = useState<MotoristaResumo[]>([]);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const loadMotoristas = useCallback(async () => {
    if (!unidadeAtiva) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data: vinculacoesData, error: vinculacoesError } = (await supabase
        .from('usuario_unidades')
        .select(`
          usuario_id,
          usuarios (id, nome, email, ativo)
        `)
        .eq('unidade_id', unidadeAtiva)
        .eq('papel', 'motorista')
        .eq('ativo', true)) as { data: VinculacaoMotorista[] | null; error: Error | null };

      if (vinculacoesError) throw vinculacoesError;

      const motoristasData = vinculacoesData
        ?.map((v) => v.usuarios)
        .filter((u): u is MotoristaResumo => u !== null && u.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setMotoristas(motoristasData || []);
    } catch (error) {
      logger.error('[useMotoristaSelection] Erro ao carregar motoristas', error);
      onError?.('Não foi possível carregar os motoristas');
    } finally {
      setIsLoading(false);
    }
  }, [onError, unidadeAtiva]);

  useEffect(() => {
    loadMotoristas();
  }, [loadMotoristas]);

  return {
    motoristas,
    motoristaSelecionado,
    setMotoristaSelecionado,
    isLoading,
    reload: loadMotoristas,
  };
}
