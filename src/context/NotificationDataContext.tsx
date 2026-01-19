/**
 * Notification Data Context
 *
 * Provides stable notification data and realtime subscription
 * that persists across navigation (avoiding WebSocket reconnection issues)
 */

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { Notificacao, NotificacaoComDetalhes } from '@/types/notifications';
import { notifyGenericWeb } from '@/utils/browserNotification';
import { warningHaptic } from '@/utils/haptics';
import { playNotificationSound } from '@/utils/notificationSound';
import { toast } from '@/utils/toast';

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

const NotificationDataContext = createContext<NotificationDataContextType | undefined>(undefined);

export function useNotificationData() {
  const context = useContext(NotificationDataContext);
  if (!context) {
    throw new Error('useNotificationData must be used within NotificationDataProvider');
  }
  return context;
}

interface NotificationDataProviderProps {
  children: React.ReactNode;
}

export function NotificationDataProvider({ children }: NotificationDataProviderProps) {
  const { userData } = useUser();
  const { session } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacaoComDetalhes[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Refs for stable subscription management
  const isSubscribed = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNaoLidas = useRef<number>(0);

  const loadNotifications = useCallback(async (reset = true) => {
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
          .from('notificacoes')
          .select(`
            *,
            rota:rotas(data, status),
            parada:paradas(endereco, ordem),
            incidente:incidentes(categoria, descricao)
          `)
          .eq('usuario_id', userData.id)
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        // Contagem separada de TODAS as não lidas (não apenas da primeira página)
        supabase
          .from('notificacoes')
          .select('id', { count: 'exact', head: true })
          .eq('usuario_id', userData.id)
          .eq('lida', false),
      ]);

      if (notificacoesResult.error) throw notificacoesResult.error;

      const notificacoesComDetalhes = (notificacoesResult.data || []) as NotificacaoComDetalhes[];
      setNotificacoes(notificacoesComDetalhes);

      // Usar contagem exata do banco, não apenas da página atual
      const totalNaoLidas = countResult.count ?? notificacoesComDetalhes.filter((n) => !n.lida).length;
      setNaoLidas(totalNaoLidas);
      lastNaoLidas.current = totalNaoLidas;

      setHasMore(notificacoesComDetalhes.length === PAGE_SIZE);
    } catch (error) {
      logger.error('[Notificações] Erro ao carregar', error);
    } finally {
      setLoading(false);
    }
  }, [userData?.id]);

  const loadMore = useCallback(async () => {
    if (!userData?.id || !hasMore || isLoadingMore || loading) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const offset = notificacoes.length;
      const { data, error } = await supabase
        .from('notificacoes')
        .select(`
          *,
          rota:rotas(data, status),
          parada:paradas(endereco, ordem),
          incidente:incidentes(categoria, descricao)
        `)
        .eq('usuario_id', userData.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const newNotificacoes = (data || []) as NotificacaoComDetalhes[];

      if (newNotificacoes.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setNotificacoes((prev) => [...prev, ...newNotificacoes]);
    } catch (error) {
      logger.error('[Notificações] Erro ao carregar mais', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [userData?.id, hasMore, isLoadingMore, loading, notificacoes.length]);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Stable Realtime subscription - only setup once when user is authenticated
  useEffect(() => {
    if (!userData?.id || !session?.access_token) {
      logger.debug('[Realtime:Notificacoes] Aguardando userData e session...');
      return;
    }

    // Prevent duplicate subscriptions
    if (isSubscribed.current) {
      logger.debug('[Realtime:Notificacoes] Já inscrito, ignorando...');
      return;
    }

    logger.info('[Realtime:Notificacoes] Criando subscription para:', userData.id);

    // Set auth token BEFORE creating channel (required for RLS)
    supabase.realtime.setAuth(session.access_token);

    isSubscribed.current = true;

    const channelName = `notificacoes-${userData.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${userData.id}`,
        },
        (payload) => {
          logger.debug('[Realtime:Notificacoes] INSERT recebido:', payload.new);
          const nova = payload.new as Notificacao;

          setNotificacoes((prev) => [nova as NotificacaoComDetalhes, ...prev]);
          setNaoLidas((prev) => prev + 1);

          // Multi-platform feedback
          if (Platform.OS === 'web') {
            notifyGenericWeb(nova.titulo, nova.mensagem || 'Nova notificação');
            playNotificationSound();
          } else {
            warningHaptic();
            playNotificationSound();
          }

          toast.info(nova.mensagem || 'Nova notificação', nova.titulo);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${userData.id}`,
        },
        (payload) => {
          logger.debug('[Realtime:Notificacoes] UPDATE recebido:', payload.new);
          const atualizada = payload.new as Notificacao;

          setNotificacoes((prev) =>
            prev.map((n) => (n.id === atualizada.id ? { ...n, ...atualizada } : n))
          );

          setNaoLidas((prev) => {
            const delta = atualizada.lida ? -1 : 1;
            return Math.max(0, prev + delta);
          });
        }
      )
      .subscribe((status, err) => {
        logger.debug('[Realtime:Notificacoes] Status:', status, err ? `Erro: ${err.message}` : '');

        if (status === 'SUBSCRIBED') {
          logger.info('[Realtime:Notificacoes] Conectado e ouvindo eventos');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('[Realtime:Notificacoes] Conexão falhou:', status, '(polling ativo como fallback)');
          isSubscribed.current = false;
        } else if (status === 'CLOSED') {
          logger.debug('[Realtime:Notificacoes] Canal fechado');
          isSubscribed.current = false;
        }
      });

    channelRef.current = channel;

    // Cleanup only when user changes or logs out
    return () => {
      logger.debug('[Realtime:Notificacoes] Limpando subscription...');
      isSubscribed.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userData?.id, session?.access_token]);

  // Polling fallback - checks for new notifications every 30s
  useEffect(() => {
    if (!userData?.id) return;

    const pollNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notificacoes')
          .select('id, lida')
          .eq('usuario_id', userData.id)
          .eq('lida', false);

        if (error) return;

        const count = data?.length || 0;

        if (count !== lastNaoLidas.current) {
          const previousCount = lastNaoLidas.current;
          logger.debug('[Polling:Notificacoes] Contagem atualizada:', previousCount, '->', count);
          lastNaoLidas.current = count;
          setNaoLidas(count);

          if (count > previousCount) {
            await loadNotifications(false);
          }
        }
      } catch {
        // Silent - don't interrupt the user
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
  }, [userData?.id, loadNotifications]);

  const marcarComoLida = useCallback(
    async (id: string) => {
      if (!userData?.id) return;

      try {
        const { error } = await supabase
          .from('notificacoes')
          .update({ lida: true })
          .eq('id', id)
          .eq('usuario_id', userData.id);

        if (error) throw error;
      } catch (error) {
        logger.error('[Notificações] Erro ao marcar como lida', error);
        toast.error('Erro ao marcar notificação como lida');
      }
    },
    [userData?.id]
  );

  const marcarTodasComoLidas = useCallback(async () => {
    if (!userData?.id) return;

    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('usuario_id', userData.id)
        .eq('lida', false);

      if (error) throw error;

      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
      setNaoLidas(0);
    } catch (error) {
      logger.error('[Notificações] Erro ao marcar todas como lidas', error);
      toast.error('Erro ao marcar notificações como lidas');
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
