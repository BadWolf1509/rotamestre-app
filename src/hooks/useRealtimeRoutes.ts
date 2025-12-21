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
 * ✅ Usa refs para evitar reconexões desnecessárias
 */
export function useRealtimeRoutes(options: UseRealtimeRoutesOptions = {}) {
  const { enabled = true, onRouteUpdate, debounceMs = 1000 } = options;
  const { unidadeAtiva } = useUnidadeAtiva();
  const { session } = useAuth();
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // ✅ Refs para controlar estado
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdate = useRef(false);
  const isSubscribed = useRef(false);
  const currentUnidade = useRef<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

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

  // ✅ Atualizar ref do token quando mudar
  useEffect(() => {
    if (session?.access_token) {
      accessTokenRef.current = session.access_token;
    }
  }, [session?.access_token]);

  useEffect(() => {
    // ✅ Só subscrever se autenticado E com unidade ativa
    if (!enabled || !unidadeAtiva || !session?.access_token) {
      return;
    }

    // ✅ Evitar reconexão se já estiver subscrito na mesma unidade
    if (isSubscribed.current && currentUnidade.current === unidadeAtiva) {
      return;
    }

    // ✅ CRÍTICO: Definir token ANTES de criar o canal (workaround para Issue #1304)
    // https://github.com/supabase/supabase-js/issues/1304
    supabase.realtime.setAuth(session.access_token);

    // ✅ Marcar como subscrito
    isSubscribed.current = true;
    currentUnidade.current = unidadeAtiva;

    const channel = supabase
      .channel(`rotas-${unidadeAtiva}`) // ✅ Canal único por unidade
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rotas',
          filter: `unidade_id=eq.${unidadeAtiva}`,
        },
        () => {
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
        () => {
          triggerUpdate();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          isSubscribed.current = false;
        }
      });

    return () => {
      isSubscribed.current = false;
      currentUnidade.current = null;
      supabase.removeChannel(channel);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [enabled, session?.access_token, triggerUpdate, unidadeAtiva]);

  return { updateTrigger };
}
