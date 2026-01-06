import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { Notificacao, NotificacaoComDetalhes } from '@/types/notifications';
import { notifyGenericWeb } from '@/utils/browserNotification';
import { warningHaptic } from '@/utils/haptics';
import { playNotificationSound } from '@/utils/notificationSound';
import { toast } from '@/utils/toast';

import { useAuth } from './useAuth';
import { useUser } from './useUser';

const PAGE_SIZE = 20;

interface UseNotificationsReturn {
  notificacoes: NotificacaoComDetalhes[];
  naoLidas: number;
  loading: boolean;
  hasMore: boolean;
  marcarComoLida: (id: string) => Promise<void>;
  marcarTodasComoLidas: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const { userData } = useUser();
  const { session } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacaoComDetalhes[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Ref para controle do Realtime (evita múltiplas subscriptions)
  const isSubscribed = useRef(false);
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
        .range(0, PAGE_SIZE - 1);

      if (error) throw error;

      const notificacoesComDetalhes = (data || []) as NotificacaoComDetalhes[];
      setNotificacoes(notificacoesComDetalhes);
      setNaoLidas(notificacoesComDetalhes.filter((n) => !n.lida).length);
      setHasMore(notificacoesComDetalhes.length === PAGE_SIZE);
    } catch (error) {
      logger.error('[Notificações] Erro ao carregar', error);
    } finally {
      setLoading(false);
    }
  }, [userData?.id]);

  // Load more notifications (pagination)
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

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription para novas notificações
  useEffect(() => {
    if (!userData?.id || !session?.access_token) {
      logger.debug('[Realtime:Notificacoes] Aguardando userData e session...');
      return;
    }

    // Evitar reconexão desnecessária
    if (isSubscribed.current) {
      logger.debug('[Realtime:Notificacoes] Já inscrito, ignorando...');
      return;
    }

    logger.info('[Realtime:Notificacoes] Criando subscription para:', userData.id);

    // CRÍTICO: Configurar token ANTES de criar o canal
    // Sem isso, RLS bloqueia os eventos
    supabase.realtime.setAuth(session.access_token);

    isSubscribed.current = true;

    const channelName = `notificacoes-${userData.id}-${Date.now()}`;
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

          // Adicionar ao topo da lista
          setNotificacoes((prev) => [nova as NotificacaoComDetalhes, ...prev]);
          setNaoLidas((prev) => prev + 1);

          // Feedback multi-plataforma
          if (Platform.OS === 'web') {
            // Web: Browser notification + som + toast
            notifyGenericWeb(nova.titulo, nova.mensagem || 'Nova notificação');
            playNotificationSound();
          } else {
            // Mobile: Haptic + som (push notification já é enviado pelo backend)
            warningHaptic();
            playNotificationSound();
          }

          // Toast notification (funciona em todas as plataformas)
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

          // Atualizar contador de não lidas
          setNaoLidas((prev) => {
            const delta = atualizada.lida ? -1 : 1;
            return Math.max(0, prev + delta);
          });
        }
      )
      .subscribe((status, err) => {
        logger.debug('[Realtime:Notificacoes] Status:', status, err ? `Erro: ${err.message}` : '');

        if (status === 'SUBSCRIBED') {
          logger.info('[Realtime:Notificacoes] ✅ Conectado e ouvindo eventos');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Timeout é comum na primeira conexão - fallback de polling está ativo
          logger.warn('[Realtime:Notificacoes] ⚠️ Conexão falhou:', status, '(polling ativo como fallback)');
          isSubscribed.current = false;
        } else if (status === 'CLOSED') {
          logger.debug('[Realtime:Notificacoes] Canal fechado');
          isSubscribed.current = false;
        }
      });

    return () => {
      logger.debug('[Realtime:Notificacoes] Limpando subscription...');
      isSubscribed.current = false;
      supabase.removeChannel(channel);
    };
  }, [userData?.id, session?.access_token]);

  // Polling como fallback - verifica novas notificações a cada 30s
  // Isso garante que o contador atualize mesmo se Realtime falhar
  useEffect(() => {
    if (!userData?.id) return;

    // Função de polling silencioso (não mostra loading)
    const pollNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notificacoes')
          .select('id, lida')
          .eq('usuario_id', userData.id)
          .eq('lida', false);

        if (error) return;

        const count = data?.length || 0;

        // Só atualiza se a contagem mudou (evita re-renders desnecessários)
        if (count !== lastNaoLidas.current) {
          const previousCount = lastNaoLidas.current;
          logger.debug('[Polling:Notificacoes] Contagem atualizada:', previousCount, '->', count);
          lastNaoLidas.current = count;
          setNaoLidas(count);

          // Se aumentou, recarrega a lista completa para pegar novas notificações
          if (count > previousCount) {
            await loadNotifications(false);
          }
        }
      } catch {
        // Silencioso - não interrompe o usuário
      }
    };

    // Polling a cada 30 segundos
    pollingInterval.current = setInterval(pollNotifications, 30000);

    // Primeira verificação imediata
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
      try {
        const { error } = await supabase
          .from('notificacoes')
          .update({ lida: true })
          .eq('id', id)
          .eq('usuario_id', userData!.id);

        if (error) throw error;

        // Atualização local será feita pelo realtime
      } catch (error) {
        logger.error('[Notificações] Erro ao marcar como lida', error);
        toast.error('Erro ao marcar notificação como lida');
      }
    },
    [userData]
  );

  const marcarTodasComoLidas = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('usuario_id', userData!.id)
        .eq('lida', false);

      if (error) throw error;

      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
      setNaoLidas(0);
    } catch (error) {
      logger.error('[Notificações] Erro ao marcar todas como lidas', error);
      toast.error('Erro ao marcar notificações como lidas');
    }
  }, [userData]);

  const refresh = useCallback(async () => {
    setHasMore(true);
    await loadNotifications(true);
  }, [loadNotifications]);

  return {
    notificacoes,
    naoLidas,
    loading,
    hasMore,
    marcarComoLida,
    marcarTodasComoLidas,
    refresh,
    loadMore,
  };
}
