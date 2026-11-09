/**
 * Hook para gerenciar seleção de motoristas
 * Carrega lista de motoristas da unidade ativa
 */

import { useState, useCallback, useEffect, useRef } from 'react';

import type { MotoristaResumo } from '@/components/gestor/nova-entrega/types';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { buscarMotoristasAtivosDaLoja } from '@/lib/gestor/motoristasDaLoja';
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
  // Contador de requisição: só a carga MAIS RECENTE escreve no estado (troca de
  // loja com carga lenta não deixa a resposta da anterior vencer).
  const requisicaoRef = useRef(0);

  const loadMotoristas = useCallback(async () => {
    const minha = ++requisicaoRef.current;
    const vigente = () => minha === requisicaoRef.current;

    if (!unidadeAtiva) {
      setMotoristas([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setMotoristas([]);
      const ativos = await buscarMotoristasAtivosDaLoja(unidadeAtiva);
      if (!vigente()) return;

      const activeDrivers: MotoristaResumo[] = ativos.map(
        ({ ultimo_login, telefone: _telefone, ...u }) => ({
          ...u,
          nuncaEntrou: ultimo_login === null,
        }),
      );
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
        if (!vigente()) return;

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
        if (!vigente()) return;

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
        if (!vigente()) return;
        logger.warn(
          '[useMotoristaSelection] Resumo de carga indisponível',
          workloadError,
        );
      }
    } catch (error) {
      if (!vigente()) return;
      logger.error(
        '[useMotoristaSelection] Erro ao carregar motoristas',
        error,
      );
      onError?.('Não foi possível carregar os motoristas');
    } finally {
      // Só a carga mais recente encerra o carregamento.
      if (vigente()) setIsLoading(false);
    }
  }, [onError, unidadeAtiva]);

  useEffect(() => {
    setMotoristaSelecionado('');
    // Disparo proposital, sem espera: o carregador trata o próprio erro (try/catch com log).
    void loadMotoristas();
  }, [loadMotoristas]);

  return {
    motoristas,
    motoristaSelecionado,
    setMotoristaSelecionado,
    isLoading,
    reload: loadMotoristas,
  };
}
