import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { useAuth } from './useAuth';
import { useUnidadeAtiva } from './useUnidadeAtiva';

interface UseRealtimeRoutesOptions {
  enabled?: boolean;
  onRouteUpdate?: () => void;
  debounceMs?: number; // Tempo de debounce em ms (padrão: 1000ms)
}

/**
 * Hook para subscrever atualizações em tempo real de rotas e paradas
 * Automaticamente recarrega dados quando há mudanças no banco
 * ✅ Otimizado com debounce para evitar múltiplas atualizações simultâneas
 * ✅ Aguarda autenticação antes de subscrever (fix para produção)
 */
export function useRealtimeRoutes(options: UseRealtimeRoutesOptions = {}) {
  const { enabled = true, onRouteUpdate, debounceMs = 1000 } = options;
  const { unidadeAtiva } = useUnidadeAtiva();
  const { session } = useAuth(); // ✅ Verificar se usuário está autenticado
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // ✅ Ref para controlar debounce
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdate = useRef(false);

  const triggerUpdate = useCallback(() => {
    // ✅ Se já houver um timer ativo, cancelar
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // ✅ Marcar que há atualização pendente
    pendingUpdate.current = true;

    // ✅ Criar novo timer de debounce
    debounceTimer.current = setTimeout(() => {
      if (pendingUpdate.current) {
        setUpdateTrigger((prev) => prev + 1);
        onRouteUpdate?.();
        pendingUpdate.current = false;
      }
      debounceTimer.current = null;
    }, debounceMs);
  }, [onRouteUpdate, debounceMs]);

  useEffect(() => {
    // ✅ Só subscrever se autenticado E com unidade ativa
    if (!enabled || !unidadeAtiva || !session?.access_token) {
      console.log('[Realtime] Aguardando autenticação ou unidade ativa...');
      return;
    }

    console.log('[Realtime] Iniciando subscrição com token válido');
    const channel = supabase
      .channel('rotas-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'rotas',
          filter: `unidade_id=eq.${unidadeAtiva}`,
        },
        (payload) => {
          console.log('[Realtime] Rota atualizada:', payload.eventType, payload.new);
          triggerUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'paradas',
        },
        (payload) => {
          console.log('[Realtime] Parada atualizada:', payload.new);
          triggerUpdate();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status da subscrição:', status);
      });

    return () => {
      console.log('[Realtime] Removendo canal de subscrição');
      supabase.removeChannel(channel);

      // ✅ Limpar timer de debounce ao desmontar
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [enabled, unidadeAtiva, triggerUpdate, session?.access_token]);

  return { updateTrigger };
}
