/**
 * Hook for Supabase Realtime subscription to route/paradas changes
 *
 * Features: debounced reload, auth token management, exponential backoff reconnect, polling fallback
 */

import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { nomeDeCanalUnico } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { notifyNewRouteWeb } from '@/utils/browserNotification';
import { warningHaptic } from '@/utils/haptics';
import { playNotificationSound } from '@/utils/notificationSound';

interface UseRouteRealtimeOptions {
  motoristaId: string | undefined;
  /** Rota na tela: as paradas são assinadas só dela (re-assina ao trocar). */
  rotaId?: string;
  accessToken: string | undefined;
  loadActiveRoute: () => Promise<void>;
}

const MAX_RECONNECT_ATTEMPTS = 3;
/** Revalidação silenciosa enquanto há rota na tela (rota apagada/reatribuída). */
const REVALIDACAO_COM_ROTA_MS = 90_000;

/**
 * Assinaturas filtradas, sem DELETE nem `'*'`.
 *
 * - `rotas` só do motorista (`motorista_id=eq.<eu>`) e `paradas` só da rota na
 *   tela (`rota_id=eq.<rota>`). Sem filtro, todo motorista recarregava a cada
 *   mudança em qualquer loja.
 * - Nada de DELETE: o realtime não aplica RLS a DELETE (ver PROJECT_CONTEXT) e
 *   não filtra DELETE por coluna que não seja a chave. A remoção de parada pelo
 *   gestor é seguida de UPDATE (reordenação das restantes e da rota), que chega
 *   pelos canais filtrados; a rota apagada ou reatribuída sai da tela na
 *   revalidação periódica (90 s, só com rota na tela), na volta ao primeiro
 *   plano, na reconexão ou no puxar-para-atualizar.
 * - O canal não depende do VALOR do token (só de existir): o refresh do token
 *   atualiza o `setAuth` sem recriar o canal.
 */
export function useRouteRealtimeSubscription({
  motoristaId,
  rotaId,
  accessToken,
  loadActiveRoute,
}: UseRouteRealtimeOptions) {
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const houveErroRef = useRef(false);

  // Identidade de `loadActiveRoute` não deve recriar o canal.
  const loadRef = useRef(loadActiveRoute);
  useEffect(() => {
    loadRef.current = loadActiveRoute;
  }, [loadActiveRoute]);

  // Recarga disparada por evento/timer, sem espera: a falha vira log em vez de
  // rejeição sem dono (o `loadActiveRoute` vem de fora e não promete tratar o erro).
  const recarregar = () => {
    loadRef
      .current()
      .catch((error) =>
        logger.warn('[Realtime] Falha ao recarregar a rota ativa', error),
      );
  };

  // Token: o refresh só atualiza a autenticação do socket.
  useEffect(() => {
    if (accessToken) {
      supabase.realtime
        .setAuth(accessToken)
        .catch((error) =>
          logger.warn('[Realtime] Erro ao reautenticar o socket', error),
        );
    }
  }, [accessToken]);
  const hasToken = !!accessToken;

  // Volta do segundo plano: revalidação silenciosa (o socket pode ter caído
  // e eventos perdidos não voltam).
  useEffect(() => {
    if (!motoristaId) return;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') recarregar();
    });
    return () => sub.remove();
  }, [motoristaId]);

  // Rota apagada ou reatribuída pelo gestor não chega por este canal: não há
  // DELETE, e o UPDATE da reatribuição sai do filtro `motorista_id=eq.<eu>`.
  // Enquanto há rota na tela, uma revalidação silenciosa (não liga `loading`)
  // a cada 90 s tira a rota que não é mais do motorista.
  useEffect(() => {
    if (!rotaId) return;
    const intervalo = setInterval(() => {
      recarregar();
    }, REVALIDACAO_COM_ROTA_MS);
    return () => clearInterval(intervalo);
  }, [rotaId]);

  useEffect(() => {
    // Aguardar autenticação E motorista ID
    if (!motoristaId || !hasToken) {
      return;
    }

    reconnectAttempts.current = 0;
    houveErroRef.current = false;

    // Função de debounce para evitar múltiplas chamadas
    const debouncedReload = () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        recarregar();
      }, 500);
    };

    let channel = supabase
      .channel(nomeDeCanalUnico(`motorista-routes-${motoristaId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rotas',
          filter: `motorista_id=eq.${motoristaId}`,
        },
        () => {
          // Feedback imediato para o motorista. No nativo, sem notificação
          // local: o push `nova_rota_atribuida` do servidor já avisa (também
          // com o app aberto), e a local duplicava o aviso sem levar a lugar
          // nenhum no toque. O payload do realtime não traz o embed
          // `unidades`, então o aviso do web não cita a loja.
          if (Platform.OS === 'web') {
            notifyNewRouteWeb();
            // Feedback sem espera; a função já engole a própria falha.
            void playNotificationSound();
          } else {
            // Feedback sem espera; a função já engole a própria falha.
            void warningHaptic();
            void playNotificationSound();
          }

          debouncedReload();
        },
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
        },
      );

    if (rotaId) {
      for (const evento of ['INSERT', 'UPDATE'] as const) {
        channel = channel.on(
          'postgres_changes',
          {
            event: evento,
            schema: 'public',
            table: 'paradas',
            filter: `rota_id=eq.${rotaId}`,
          },
          () => {
            debouncedReload();
          },
        );
      }
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        reconnectAttempts.current = 0;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        // Reconectou depois de erro: os eventos do intervalo se perderam.
        if (houveErroRef.current) {
          houveErroRef.current = false;
          recarregar();
        }
        logger.info('[RouteStatus] Realtime conectado com sucesso');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        houveErroRef.current = true;
        reconnectAttempts.current += 1;
        logger.warn('[RouteStatus] Realtime erro na conexão', {
          status,
          attempt: reconnectAttempts.current,
          maxAttempts: MAX_RECONNECT_ATTEMPTS,
        });

        // NÃO chamar channel.subscribe() de novo: o Phoenix/Supabase lança
        // "tried to join multiple times" se o mesmo channel for re-inscrito.
        // O realtime-js já reconecta o socket automaticamente. Após esgotar
        // as tentativas, caímos no polling até o SUBSCRIBED voltar.
        if (
          reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS &&
          !pollIntervalRef.current
        ) {
          logger.error(
            '[RouteStatus] Realtime máximo de tentativas atingido - usando polling',
          );
          // Fallback: recarregar dados manualmente a cada 30s
          pollIntervalRef.current = setInterval(() => {
            recarregar();
          }, 30000);
        }
      }
    });

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      // Limpeza no desmonte, sem espera: não há o que fazer com o resultado.
      void supabase.removeChannel(channel);
    };
  }, [motoristaId, rotaId, hasToken]);
}
