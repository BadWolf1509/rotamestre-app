import { useEffect, useRef } from "react";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { Notificacao } from "@/types/notifications";

interface UseNotificationRealtimeOptions {
  userId: string | undefined;
  accessToken: string | undefined;
  onInsert: (notification: Notificacao) => void;
  onUpdate: (notification: Notificacao) => void;
}

/**
 * Manages the Supabase Realtime subscription for notifications.
 * Handles INSERT and UPDATE events with proper cleanup.
 */
export function useNotificationRealtime({
  userId,
  accessToken,
  onInsert,
  onUpdate,
}: UseNotificationRealtimeOptions) {
  const isSubscribed = useRef(false);
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

  useEffect(() => {
    if (!userId || !accessToken) {
      logger.debug("[Realtime:Notificacoes] Aguardando userData e session...");
      return;
    }

    if (isSubscribed.current) {
      logger.debug("[Realtime:Notificacoes] Já inscrito, ignorando...");
      return;
    }

    logger.info("[Realtime:Notificacoes] Criando subscription para:", userId);

    supabase.realtime.setAuth(accessToken);
    isSubscribed.current = true;

    const channelName = `notificacoes-${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug("[Realtime:Notificacoes] INSERT recebido:", payload.new);
          onInsertRef.current(payload.new as Notificacao);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notificacoes",
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug("[Realtime:Notificacoes] UPDATE recebido:", payload.new);
          onUpdateRef.current(payload.new as Notificacao);
        },
      )
      .subscribe((status, err) => {
        logger.debug(
          "[Realtime:Notificacoes] Status:",
          status,
          err ? `Erro: ${err.message}` : "",
        );

        if (status === "SUBSCRIBED") {
          logger.info("[Realtime:Notificacoes] Conectado e ouvindo eventos");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn(
            "[Realtime:Notificacoes] Conexão falhou:",
            status,
            "(polling ativo como fallback)",
          );
          isSubscribed.current = false;
        } else if (status === "CLOSED") {
          logger.debug("[Realtime:Notificacoes] Canal fechado");
          isSubscribed.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      logger.debug("[Realtime:Notificacoes] Limpando subscription...");
      isSubscribed.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, accessToken]);
}
