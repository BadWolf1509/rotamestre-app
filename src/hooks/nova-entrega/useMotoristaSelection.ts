/**
 * Hook para gerenciar seleção de motoristas
 * Carrega lista de motoristas da unidade ativa
 */

import { useState, useCallback, useEffect } from 'react';

import type {
  MotoristaResumo,
  VinculacaoMotorista,
} from '@/components/gestor/nova-entrega/types';
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
  onError?: (message: string) => void,
): UseMotoristaSelectionReturn {
  const { unidadeAtiva } = useUnidadeAtiva();

  const [motoristas, setMotoristas] = useState<MotoristaResumo[]>([]);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const loadMotoristas = useCallback(async () => {
    if (!unidadeAtiva) {
      setMotoristas([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setMotoristas([]);
      const { data: vinculacoesData, error: vinculacoesError } = (await supabase
        .from('usuario_unidades')
        .select(
          `
          usuario_id,
          usuarios (id, nome, email, ativo)
        `,
        )
        .eq('unidade_id', unidadeAtiva)
        .eq('papel', 'motorista')
        .eq('ativo', true)) as {
        data: VinculacaoMotorista[] | null;
        error: Error | null;
      };

      if (vinculacoesError) throw vinculacoesError;

      const motoristasData = vinculacoesData
        ?.map((v) => v.usuarios)
        .filter((u): u is MotoristaResumo => u !== null && u.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      const activeDrivers = motoristasData || [];
      if (activeDrivers.length === 0) {
        setMotoristas([]);
        return;
      }

      // A lista básica continua utilizável mesmo se o resumo de carga falhar.
      setMotoristas(activeDrivers);
      try {
        const driverIds = activeDrivers.map((driver) => driver.id);
        const { data: activeRoutes, error: routesError } = await supabase
          .from('rotas')
          .select('id, motorista_id, status')
          .eq('unidade_id', unidadeAtiva)
          .in('motorista_id', driverIds)
          .in('status', ['pendente', 'em_andamento']);

        if (routesError) throw routesError;

        const routeRows = (activeRoutes || []) as Array<{
          id: string;
          motorista_id: string;
          status: 'pendente' | 'em_andamento';
        }>;
        const routeIds = routeRows.map((route) => route.id);
        let pendingStops: Array<{ rota_id: string }> = [];
        if (routeIds.length > 0) {
          const { data: stopsData, error: stopsError } = await supabase
            .from('paradas')
            .select('rota_id')
            .in('rota_id', routeIds)
            .eq('status', 'pendente')
            .or('is_checkpoint.is.null,is_checkpoint.eq.true');
          if (stopsError) throw stopsError;
          pendingStops = (stopsData || []) as Array<{ rota_id: string }>;
        }

        setMotoristas(
          activeDrivers.map((driver) => {
            const driverRoutes = routeRows.filter(
              (route) => route.motorista_id === driver.id,
            );
            const driverRouteIds = new Set(
              driverRoutes.map((route) => route.id),
            );
            return {
              ...driver,
              rotaEmAndamento: driverRoutes.some(
                (route) => route.status === 'em_andamento',
              ),
              rotasPendentes: driverRoutes.filter(
                (route) => route.status === 'pendente',
              ).length,
              paradasPendentes: pendingStops.filter((stop) =>
                driverRouteIds.has(stop.rota_id),
              ).length,
            };
          }),
        );
      } catch (workloadError) {
        logger.warn(
          '[useMotoristaSelection] Resumo de carga indisponível',
          workloadError,
        );
      }
    } catch (error) {
      logger.error(
        '[useMotoristaSelection] Erro ao carregar motoristas',
        error,
      );
      onError?.('Não foi possível carregar os motoristas');
    } finally {
      setIsLoading(false);
    }
  }, [onError, unidadeAtiva]);

  useEffect(() => {
    setMotoristaSelecionado('');
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
