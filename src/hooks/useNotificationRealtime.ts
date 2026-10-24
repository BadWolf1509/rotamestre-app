import { useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import { nomeDeCanalUnico } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import type { Notificacao } from '@/types/notifications';

interface UseNotificationRealtimeOptions {
  userId: string | undefined;
  accessToken: string | undefined;
  onInsert: (notification: Notificacao) => void;
  onUpdate: (notification: Notificacao) => void;
}

/**
 * Manages the Supabase Realtime subscription for notifications.
 * Handles INSERT and UPDATE events with proper cleanup.
 *
 * Devolve `conectado`: true só entre o SUBSCRIBED e a próxima queda (erro,
 * timeout, fechamento ou troca de usuário). O provider liga o polling de
 * reserva só quando ele é false (DP-5).
 */
export function useNotificationRealtime({
  userId,
  accessToken,
  onInsert,
  onUpdate,
}: UseNotificationRealtimeOptions) {
  const isSubscribed = useRef(false);
  const [conectado, setConectado] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Stable refs for callbacks (avoid re-subscribing on callback changes)
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Refresh do token: só reautentica o socket. O canal depende de o token
  // EXISTIR (`hasToken`), não do valor — senão cada refresh recriava o canal.
  useEffect(() => {
    if (accessToken) supabase.realtime.setAuth(accessToken);
  }, [accessToken]);
  const hasToken = !!accessToken;

  useEffect(() => {
    if (!userId || !hasToken) {
      setConectado(false);
      logger.debug('[Realtime:Notificacoes] Aguardando userData e session...');
      return;
    }

    if (isSubscribed.current) {
      logger.debug('[Realtime:Notificacoes] Já inscrito, ignorando...');
      return;
    }

    logger.info('[Realtime:Notificacoes] Criando subscription para:', userId);

    isSubscribed.current = true;
    // O `removeChannel` é assíncrono: o CLOSED do canal antigo pode chegar
    // depois do SUBSCRIBED do novo (troca de conta) e derrubar o estado.
    let canalAtual = true;

    const channelName = nomeDeCanalUnico(`notificacoes-${userId}`);
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug('[Realtime:Notificacoes] INSERT recebido:', payload.new);
          onInsertRef.current(payload.new as Notificacao);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug('[Realtime:Notificacoes] UPDATE recebido:', payload.new);
          onUpdateRef.current(payload.new as Notificacao);
        },
      )
      .subscribe((status, err) => {
        if (!canalAtual) return;
        logger.debug(
          '[Realtime:Notificacoes] Status:',
          status,
          err ? `Erro: ${err.message}` : '',
        );

        if (status === 'SUBSCRIBED') {
          setConectado(true);
          logger.info('[Realtime:Notificacoes] Conectado e ouvindo eventos');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConectado(false);
          logger.warn(
            '[Realtime:Notificacoes] Conexão falhou (polling ativo como fallback):',
            status,
          );
          isSubscribed.current = false;
        } else if (status === 'CLOSED') {
          setConectado(false);
          logger.debug('[Realtime:Notificacoes] Canal fechado');
          isSubscribed.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      logger.debug('[Realtime:Notificacoes] Limpando subscription...');
      canalAtual = false;
      isSubscribed.current = false;
      setConectado(false);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, hasToken]);

  return { conectado };
}
