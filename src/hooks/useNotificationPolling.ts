import { useEffect, useRef } from "react";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

interface UseNotificationPollingOptions {
  userId: string | undefined;
  onCountChange: (newCount: number, previousCount: number) => void;
}

/**
 * Polls for unread notification count every 30s as a fallback
 * when Realtime subscription fails or is delayed.
 */
export function useNotificationPolling({
  userId,
  onCountChange,
}: UseNotificationPollingOptions) {
  const lastCountRef = useRef<number>(0);
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable ref for callback
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  useEffect(() => {
    if (!userId) return;

    const pollNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notificacoes")
          .select("id, lida")
          .eq("usuario_id", userId)
          .eq("lida", false);

        if (error) return;

        const count = data?.length || 0;

        if (count !== lastCountRef.current) {
          const previousCount = lastCountRef.current;
          logger.debug(
            "[Polling:Notificacoes] Contagem atualizada:",
            previousCount,
            "->",
            count,
          );
          lastCountRef.current = count;
          onCountChangeRef.current(count, previousCount);
        }
      } catch (error) {
        logger.warn(
          "[Polling:Notificacoes] Falha ao carregar notificações em background",
          error,
        );
      }
    };

    pollingInterval.current = setInterval(pollNotifications, 30000);
    pollNotifications();

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [userId]);

  /** Update the lastCount ref (e.g. after manual load) */
  const setLastCount = (count: number) => {
    lastCountRef.current = count;
  };

  return { setLastCount };
}
