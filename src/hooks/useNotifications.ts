import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Notificacao, NotificacaoComDetalhes } from '@/types/notifications';

import { useToast } from './useToast';
import { useUser } from './useUser';

interface UseNotificationsReturn {
  notificacoes: NotificacaoComDetalhes[];
  naoLidas: number;
  loading: boolean;
  marcarComoLida: (id: string) => Promise<void>;
  marcarTodasComoLidas: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const { userData } = useUser();
  const { showToast } = useToast();
  const [notificacoes, setNotificacoes] = useState<NotificacaoComDetalhes[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!userData?.id) {
      setLoading(false);
      return;
    }

    try {
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
        .limit(50);

      if (error) throw error;

      const notificacoesComDetalhes = (data || []) as NotificacaoComDetalhes[];
      setNotificacoes(notificacoesComDetalhes);
      setNaoLidas(notificacoesComDetalhes.filter((n) => !n.lida).length);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [userData?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription para novas notificações
  useEffect(() => {
    if (!userData?.id) return;

    const channel = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${userData.id}`,
        },
        (payload) => {
          const nova = payload.new as Notificacao;

          // Adicionar ao topo da lista
          setNotificacoes((prev) => [nova as NotificacaoComDetalhes, ...prev]);
          setNaoLidas((prev) => prev + 1);

          // Toast notification
          if (Platform.OS === 'web') {
            showToast(nova.titulo, 'info');
          }
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userData?.id, showToast]);

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
        console.error('Erro ao marcar notificação como lida:', error);
        showToast('Erro ao marcar notificação como lida', 'error');
      }
    },
    [userData, showToast]
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
      console.error('Erro ao marcar todas como lidas:', error);
      showToast('Erro ao marcar notificações como lidas', 'error');
    }
  }, [userData, showToast]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadNotifications();
  }, [loadNotifications]);

  return {
    notificacoes,
    naoLidas,
    loading,
    marcarComoLida,
    marcarTodasComoLidas,
    refresh,
  };
}
