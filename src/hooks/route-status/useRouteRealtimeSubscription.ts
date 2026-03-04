/**
 * Hook for Supabase Realtime subscription to route/paradas changes
 *
 * Features: debounced reload, auth token management, exponential backoff reconnect, polling fallback
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { notifyRoutePending } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { notifyNewRouteWeb } from '@/utils/browserNotification';
import { warningHaptic } from '@/utils/haptics';
import { playNotificationSound } from '@/utils/notificationSound';

interface UseRouteRealtimeOptions {
  motoristaId: string | undefined;
  accessToken: string | undefined;
  loadActiveRoute: () => Promise<void>;
}

const MAX_RECONNECT_ATTEMPTS = 3;

export function useRouteRealtimeSubscription({
  motoristaId,
  accessToken,
  loadActiveRoute,
}: UseRouteRealtimeOptions) {
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribed = useRef(false);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    // Aguardar autenticação E motorista ID
    if (!motoristaId || !accessToken) {
      return;
    }

    // Evitar reconexão desnecessária
    if (isSubscribed.current) {
      return;
    }

    // CRÍTICO: Configurar token ANTES de criar o canal
    supabase.realtime.setAuth(accessToken);

    isSubscribed.current = true;

    // Função de debounce para evitar múltiplas chamadas
    const debouncedReload = () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        loadActiveRoute();
      }, 500);
    };

    const channel = supabase
      .channel(`motorista-routes-${motoristaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rotas',
          filter: `motorista_id=eq.${motoristaId}`,
        },
        async (payload) => {
          // Feedback imediato para o motorista
          const newRecord = payload.new as Record<string, unknown>;
          const unidades = newRecord.unidades as { nome?: string } | undefined;
          const unidadeNome = unidades?.nome || 'Nova rota';

          if (Platform.OS === 'web') {
            notifyNewRouteWeb(unidadeNome);
            playNotificationSound();
          } else {
            warningHaptic();
            playNotificationSound();
            notifyRoutePending(unidadeNome);
          }

          debouncedReload();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rotas',
          filter: `motorista_id=eq.${motoristaId}`,
        },
        () => {
          debouncedReload();
        }
      )
      // DELETE sem filtro (Replica Identity não está FULL)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'rotas',
        },
        () => {
          debouncedReload();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'paradas',
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribed.current = true;
          reconnectAttempts.current = 0;
          logger.info('[RouteStatus] Realtime conectado com sucesso');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('[RouteStatus] Realtime erro na conexão', {
            status,
            attempt: reconnectAttempts.current + 1,
            maxAttempts: MAX_RECONNECT_ATTEMPTS,
          });

          // Tentar reconectar com backoff exponencial
          if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            // Keep isSubscribed true — we're still trying to reconnect
            reconnectAttempts.current += 1;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);

            setTimeout(() => {
              if (accessToken) {
                supabase.realtime.setAuth(accessToken);
              }
              channel.subscribe();
            }, delay);
          } else {
            // Gave up on realtime — mark as not subscribed
            isSubscribed.current = false;
            logger.error('[RouteStatus] Realtime máximo de tentativas atingido - usando polling');
            // Fallback: recarregar dados manualmente a cada 30s
            pollIntervalRef.current = setInterval(() => {
              if (motoristaId) loadActiveRoute();
            }, 30000);
          }
        }
      });

    return () => {
      isSubscribed.current = false;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [loadActiveRoute, motoristaId, accessToken]);
}
