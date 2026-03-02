/**
 * Notification Data Context
 *
 * Thin provider that composes useNotificationRealtime, useNotificationPolling,
 * and triggerNewNotificationFeedback to provide stable notification data
 * that persists across navigation (avoiding WebSocket reconnection issues).
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import { useNotificationPolling } from "@/hooks/useNotificationPolling";
import { useNotificationRealtime } from "@/hooks/useNotificationRealtime";
import { useUser } from "@/hooks/useUser";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type {
  Notificacao,
  NotificacaoComDetalhes,
} from "@/types/notifications";
import { triggerNewNotificationFeedback } from "@/utils/notificationFeedback";
import { toast } from "@/utils/toast";

const PAGE_SIZE = 20;

interface NotificationDataContextType {
  notificacoes: NotificacaoComDetalhes[];
  naoLidas: number;
  loading: boolean;
  hasMore: boolean;
  marcarComoLida: (id: string) => Promise<void>;
  marcarTodasComoLidas: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const NotificationDataContext = createContext<
  NotificationDataContextType | undefined
>(undefined);

export function useNotificationData() {
  const context = useContext(NotificationDataContext);
  if (!context) {
    throw new Error(
      "useNotificationData must be used within NotificationDataProvider",
    );
  }
  return context;
}

interface NotificationDataProviderProps {
  children: React.ReactNode;
}

export function NotificationDataProvider({
  children,
}: NotificationDataProviderProps) {
  const { userData } = useUser();
  const { session } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacaoComDetalhes[]>(
    [],
  );
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadNotifications = useCallback(
    async (reset = true) => {
      if (!userData?.id) {
        setLoading(false);
        return;
      }

      try {
        if (reset) {
          setLoading(true);
        }

        // Buscar notificações paginadas e contagem total de não lidas em paralelo
        const [notificacoesResult, countResult] = await Promise.all([
          supabase
            .from("notificacoes")
            .select(
              `
            *,
            rota:rotas(data, status),
            parada:paradas(endereco, ordem),
            incidente:incidentes(categoria, descricao)
          `,
            )
            .eq("usuario_id", userData.id)
            .order("created_at", { ascending: false })
            .range(0, PAGE_SIZE - 1),
          // Contagem separada de TODAS as não lidas (não apenas da primeira página)
          supabase
            .from("notificacoes")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", userData.id)
            .eq("lida", false),
        ]);

        if (notificacoesResult.error) throw notificacoesResult.error;

        const notificacoesComDetalhes = (notificacoesResult.data ||
          []) as NotificacaoComDetalhes[];
        setNotificacoes(notificacoesComDetalhes);

        // Usar contagem exata do banco, não apenas da página atual
        const totalNaoLidas =
          countResult.count ??
          notificacoesComDetalhes.filter((n) => !n.lida).length;
        setNaoLidas(totalNaoLidas);

        setHasMore(notificacoesComDetalhes.length === PAGE_SIZE);
      } catch (error) {
        logger.error("[Notificações] Erro ao carregar", error);
      } finally {
        setLoading(false);
      }
    },
    [userData?.id],
  );

  const loadMore = useCallback(async () => {
    if (!userData?.id || !hasMore || isLoadingMore || loading) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const offset = notificacoes.length;
      const { data, error } = await supabase
        .from("notificacoes")
        .select(
          `
          *,
          rota:rotas(data, status),
          parada:paradas(endereco, ordem),
          incidente:incidentes(categoria, descricao)
        `,
        )
        .eq("usuario_id", userData.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const newNotificacoes = (data || []) as NotificacaoComDetalhes[];

      if (newNotificacoes.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setNotificacoes((prev) => [...prev, ...newNotificacoes]);
    } catch (error) {
      logger.error("[Notificações] Erro ao carregar mais", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [userData?.id, hasMore, isLoadingMore, loading, notificacoes.length]);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription (INSERT/UPDATE via Supabase postgres_changes)
  const handleRealtimeInsert = useCallback((nova: Notificacao) => {
    setNotificacoes((prev) => [nova as NotificacaoComDetalhes, ...prev]);
    setNaoLidas((prev) => prev + 1);
    triggerNewNotificationFeedback(nova);
  }, []);

  const handleRealtimeUpdate = useCallback((atualizada: Notificacao) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === atualizada.id ? { ...n, ...atualizada } : n)),
    );
    setNaoLidas((prev) => {
      const delta = atualizada.lida ? -1 : 1;
      return Math.max(0, prev + delta);
    });
  }, []);

  useNotificationRealtime({
    userId: userData?.id,
    accessToken: session?.access_token,
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
  });

  // Polling fallback - checks for new unread count every 30s
  const handlePollingCountChange = useCallback(
    (newCount: number, previousCount: number) => {
      setNaoLidas(newCount);
      if (newCount > previousCount) {
        loadNotifications(false);
      }
    },
    [loadNotifications],
  );

  const { setLastCount } = useNotificationPolling({
    userId: userData?.id,
    onCountChange: handlePollingCountChange,
  });

  // Sync polling lastCount whenever naoLidas changes (prevents redundant reloads)
  useEffect(() => {
    setLastCount(naoLidas);
  }, [naoLidas, setLastCount]);

  const marcarComoLida = useCallback(
    async (id: string) => {
      if (!userData?.id) return;

      try {
        const { error } = await supabase
          .from("notificacoes")
          .update({ lida: true })
          .eq("id", id)
          .eq("usuario_id", userData.id);

        if (error) throw error;
      } catch (error) {
        logger.error("[Notificações] Erro ao marcar como lida", error);
        toast.error("Erro ao marcar notificação como lida");
      }
    },
    [userData?.id],
  );

  const marcarTodasComoLidas = useCallback(async () => {
    if (!userData?.id) return;

    try {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("usuario_id", userData.id)
        .eq("lida", false);

      if (error) throw error;

      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
      setNaoLidas(0);
    } catch (error) {
      logger.error("[Notificações] Erro ao marcar todas como lidas", error);
      toast.error("Erro ao marcar notificações como lidas");
    }
  }, [userData?.id]);

  const refresh = useCallback(async () => {
    setHasMore(true);
    await loadNotifications(true);
  }, [loadNotifications]);

  return (
    <NotificationDataContext.Provider
      value={{
        notificacoes,
        naoLidas,
        loading,
        hasMore,
        marcarComoLida,
        marcarTodasComoLidas,
        refresh,
        loadMore,
      }}
    >
      {children}
    </NotificationDataContext.Provider>
  );
}
