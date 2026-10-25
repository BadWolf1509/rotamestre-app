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
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import {
  SELECT_NOTIFICACAO_COM_DETALHES,
  useNotificationPolling,
} from "@/hooks/useNotificationPolling";
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

/**
 * Junta notificações à lista sem repetir id: o mesmo INSERT pode chegar pelo
 * realtime e pelo polling, e a paginação por offset repete itens quando a
 * lista anda. As que já existem ficam como estão. Devolve a MESMA lista
 * quando não há inédita.
 */
function mesclarSemRepetir(
  lista: NotificacaoComDetalhes[],
  novas: NotificacaoComDetalhes[],
  posicao: "inicio" | "fim",
): NotificacaoComDetalhes[] {
  const ids = new Set(lista.map((n) => n.id));
  const ineditas = novas.filter((n) => {
    if (ids.has(n.id)) return false;
    ids.add(n.id);
    return true;
  });
  if (ineditas.length === 0) return lista;
  return posicao === "inicio"
    ? [...ineditas, ...lista]
    : [...lista, ...ineditas];
}

function contarNaoLidas(lista: NotificacaoComDetalhes[]): number {
  return lista.reduce((total, n) => total + (n.lida ? 0 : 1), 0);
}

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
  const userId = userData?.id;
  const [notificacoes, setNotificacoes] = useState<NotificacaoComDetalhes[]>(
    [],
  );
  // Contador (DP-6/AN6), fonte única: não lidas da lista + não lidas que
  // ficaram FORA da página carregada. Derivar só da lista erraria com mais de
  // PAGE_SIZE notificações; recontar no servidor a cada evento custaria uma
  // requisição por evento e disputaria com a atualização otimista. O "fora"
  // nasce do count exato da carga e só muda em loadMore, em UPDATE de
  // notificação não carregada e no "marcar todas".
  const [naoLidasForaDaLista, setNaoLidasForaDaLista] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const naoLidas = useMemo(
    () => naoLidasForaDaLista + contarNaoLidas(notificacoes),
    [naoLidasForaDaLista, notificacoes],
  );

  // Espelhos para os handlers assíncronos: a conta da sessão AGORA (resposta
  // de outra conta é descartada), a lista como está e o "fora da lista".
  const usuarioAtualRef = useRef(userId);
  const notificacoesRef = useRef(notificacoes);
  const foraDaListaRef = useRef(naoLidasForaDaLista);

  const definirLista = useCallback((lista: NotificacaoComDetalhes[]) => {
    notificacoesRef.current = lista;
    setNotificacoes(lista);
  }, []);
  const definirForaDaLista = useCallback((valor: number) => {
    foraDaListaRef.current = Math.max(0, valor);
    setNaoLidasForaDaLista(foraDaListaRef.current);
  }, []);

  // AN5: sem usuário (logout) ou com outro (troca de conta), nada da conta
  // anterior fica na tela.
  useEffect(() => {
    usuarioAtualRef.current = userId;
    if (notificacoesRef.current.length > 0) definirLista([]);
    definirForaDaLista(0);
    setHasMore(true);
    setIsLoadingMore(false);
  }, [userId, definirLista, definirForaDaLista]);

  const loadNotifications = useCallback(
    async (reset = true) => {
      if (!userId) {
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
            .select(SELECT_NOTIFICACAO_COM_DETALHES)
            .eq("usuario_id", userId)
            .order("created_at", { ascending: false })
            .range(0, PAGE_SIZE - 1),
          // Contagem separada de TODAS as não lidas (não apenas da primeira página)
          supabase
            .from("notificacoes")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", userId)
            .eq("lida", false),
        ]);

        if (usuarioAtualRef.current !== userId) return;
        if (notificacoesResult.error) throw notificacoesResult.error;

        const pagina = (notificacoesResult.data ||
          []) as NotificacaoComDetalhes[];
        definirLista(pagina);
        definirForaDaLista((countResult.count ?? 0) - contarNaoLidas(pagina));
        setHasMore(pagina.length === PAGE_SIZE);
      } catch (error) {
        logger.error("[Notificações] Erro ao carregar", error);
      } finally {
        if (usuarioAtualRef.current === userId) setLoading(false);
      }
    },
    [userId, definirLista, definirForaDaLista],
  );

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || isLoadingMore || loading) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const offset = notificacoes.length;
      const { data, error } = await supabase
        .from("notificacoes")
        .select(SELECT_NOTIFICACAO_COM_DETALHES)
        .eq("usuario_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (usuarioAtualRef.current !== userId) return;
      if (error) throw error;

      const pagina = (data || []) as NotificacaoComDetalhes[];

      if (pagina.length < PAGE_SIZE) {
        setHasMore(false);
      }

      // As inéditas saem do "fora da lista" e passam a contar pela lista.
      const atual = notificacoesRef.current;
      const mesclada = mesclarSemRepetir(atual, pagina, "fim");
      const trazidasDeFora = contarNaoLidas(mesclada) - contarNaoLidas(atual);
      definirLista(mesclada);
      definirForaDaLista(foraDaListaRef.current - trazidasDeFora);
    } catch (error) {
      logger.error("[Notificações] Erro ao carregar mais", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    userId,
    hasMore,
    isLoadingMore,
    loading,
    notificacoes.length,
    definirLista,
    definirForaDaLista,
  ]);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription (INSERT/UPDATE via Supabase postgres_changes)
  const handleRealtimeInsert = useCallback(
    (nova: Notificacao) => {
      const atual = notificacoesRef.current;
      const mesclada = mesclarSemRepetir(
        atual,
        [nova as NotificacaoComDetalhes],
        "inicio",
      );
      // Repetida: nem lista, nem contador, nem aviso.
      if (mesclada === atual) return;
      definirLista(mesclada);
      triggerNewNotificationFeedback(nova);
    },
    [definirLista],
  );

  const handleRealtimeUpdate = useCallback(
    (atualizada: Notificacao) => {
      const atual = notificacoesRef.current;
      if (atual.some((n) => n.id === atualizada.id)) {
        // Na lista: o contador acompanha sozinho (só muda se `lida` mudou).
        definirLista(
          atual.map((n) =>
            n.id === atualizada.id ? { ...n, ...atualizada } : n,
          ),
        );
        return;
      }
      // Fora da lista o valor anterior é desconhecido (o payload do UPDATE
      // não traz o `old`). O único UPDATE que o app faz é marcar lida — e o
      // "marcar todas" filtra `lida = false` —, então lida=true aqui é uma
      // não lida de fora que deixou de ser.
      if (atualizada.lida) {
        definirForaDaLista(foraDaListaRef.current - 1);
      }
    },
    [definirLista, definirForaDaLista],
  );

  const { conectado: realtimeConectado } = useNotificationRealtime({
    userId,
    accessToken: session?.access_token,
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
  });

  // Polling de reserva (DP-5): só com o realtime fora, e só o que é novo.
  const handleNovasDoPolling = useCallback(
    (novas: NotificacaoComDetalhes[]) => {
      const atual = notificacoesRef.current;
      const mesclada = mesclarSemRepetir(atual, novas, "inicio");
      if (mesclada !== atual) definirLista(mesclada);
    },
    [definirLista],
  );

  const maisNovaVista = useMemo(
    () =>
      notificacoes.reduce<string | null>(
        (maior, n) =>
          maior === null || n.created_at > maior ? n.created_at : maior,
        null,
      ),
    [notificacoes],
  );

  useNotificationPolling({
    userId,
    ativo: !realtimeConectado,
    desde: maisNovaVista,
    onNovas: handleNovasDoPolling,
  });

  const marcarComoLida = useCallback(
    async (id: string) => {
      if (!userId) return;

      // Otimista: a tela muda na hora, sem esperar o eco do realtime.
      const eraNaoLida = notificacoesRef.current.some(
        (n) => n.id === id && !n.lida,
      );
      const definirLida = (lida: boolean) =>
        definirLista(
          notificacoesRef.current.map((n) =>
            n.id === id ? { ...n, lida } : n,
          ),
        );
      if (eraNaoLida) definirLida(true);

      try {
        const { error } = await supabase
          .from("notificacoes")
          .update({ lida: true })
          .eq("id", id)
          .eq("usuario_id", userId);

        if (error) throw error;
      } catch (error) {
        if (eraNaoLida && usuarioAtualRef.current === userId) {
          definirLida(false);
        }
        logger.error("[Notificações] Erro ao marcar como lida", error);
        toast.error("Erro ao marcar notificação como lida");
      }
    },
    [userId, definirLista],
  );

  const marcarTodasComoLidas = useCallback(async () => {
    if (!userId) return;

    // Otimista, guardando o necessário para desfazer: só as que ERAM não
    // lidas voltam (uma nova que chegou no meio continua como veio).
    const idsNaoLidas = new Set(
      notificacoesRef.current.filter((n) => !n.lida).map((n) => n.id),
    );
    const foraAntes = foraDaListaRef.current;
    definirLista(
      notificacoesRef.current.map((n) => (n.lida ? n : { ...n, lida: true })),
    );
    definirForaDaLista(0);

    try {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("usuario_id", userId)
        .eq("lida", false);

      if (error) throw error;
    } catch (error) {
      if (usuarioAtualRef.current === userId) {
        definirLista(
          notificacoesRef.current.map((n) =>
            idsNaoLidas.has(n.id) ? { ...n, lida: false } : n,
          ),
        );
        definirForaDaLista(foraAntes);
      }
      logger.error("[Notificações] Erro ao marcar todas como lidas", error);
      toast.error("Erro ao marcar notificações como lidas");
    }
  }, [userId, definirLista, definirForaDaLista]);

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
