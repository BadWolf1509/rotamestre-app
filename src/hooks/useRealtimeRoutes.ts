import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { useAuth } from './useAuth';
import { useUnidadeAtiva } from './useUnidadeAtiva';

// Contador module-level p/ gerar um nome de canal único por montagem (ver uso abaixo).
let channelInstanceCounter = 0;

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

  // ✅ Ref do trigger: mudanças de identidade do callback NÃO devem re-executar
  //    o efeito de subscription (era o que reusava um canal já inscrito → erro
  //    "cannot add postgres_changes callbacks after subscribe()" no SDK 56).
  const triggerUpdateRef = useRef(triggerUpdate);
  useEffect(() => {
    triggerUpdateRef.current = triggerUpdate;
  }, [triggerUpdate]);

  // ✅ Atualizar ref do token quando mudar
  useEffect(() => {
    if (session?.access_token) {
      accessTokenRef.current = session.access_token;
      // ✅ Mantém o realtime autenticado no refresh de token SEM recriar o canal
      supabase.realtime.setAuth(session.access_token);
    }
  }, [session?.access_token]);

  // ✅ Boolean estável: dispara o efeito quando o token passa a EXISTIR, mas não
  //    quando o valor muda (refresh). Evita re-subscribe/churn que reusava o canal.
  const hasToken = !!session?.access_token;

  useEffect(() => {
    // ✅ Só subscrever se autenticado E com unidade ativa
    if (!enabled || !unidadeAtiva || !hasToken) {
      return;
    }

    // ✅ Evitar reconexão se já estiver subscrito na mesma unidade
    if (isSubscribed.current && currentUnidade.current === unidadeAtiva) {
      return;
    }

    // ✅ CRÍTICO: Definir token ANTES de criar o canal (workaround para Issue 1304)
    // https://github.com/supabase/supabase-js/issues/1304
    if (accessTokenRef.current) {
      supabase.realtime.setAuth(accessTokenRef.current);
    }

    // ✅ Marcar como subscrito
    isSubscribed.current = true;
    currentUnidade.current = unidadeAtiva;

    // Nome de canal único por montagem: o removeChannel do cleanup é assíncrono,
    // então uma remontagem rápida (navegar e voltar) reusaria um canal já inscrito
    // → "cannot add postgres_changes callbacks after subscribe()" no SDK 56.
    channelInstanceCounter += 1;
    const channel = supabase
      .channel(`rotas-${unidadeAtiva}-${channelInstanceCounter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rotas',
          filter: `unidade_id=eq.${unidadeAtiva}`,
        },
        () => {
          triggerUpdateRef.current();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'paradas',
        },
        () => {
          triggerUpdateRef.current();
        },
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
    // unidadeAtiva define o canal; hasToken dispara o subscribe inicial.
    // O valor do token e o callback são lidos via ref (não reativos aqui).
  }, [enabled, unidadeAtiva, hasToken]);

  return { updateTrigger };
}
