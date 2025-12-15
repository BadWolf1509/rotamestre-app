import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

interface TimelineEvent {
  id: string;
  type: 'status_change' | 'parada_update' | 'incidente' | 'gps_update';
  timestamp: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface RouteTimelineProps {
  rotaId: string;
  /** Se true, subscreve a realtime updates */
  realtime?: boolean;
  /** Notifica o pai sobre loading/quantidade para habilitar colapsar o card */
  onStateChange?: (state: { loading: boolean; events: number }) => void;
}

export function RouteTimeline({ rotaId, realtime = true, onStateChange }: RouteTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar dados de múltiplas fontes
      const [logsRes, paradasRes, incidentesRes] = await Promise.all([
        // Logs da rota
        supabase
          .from('logs')
          .select('*')
          .eq('rota_id', rotaId)
          .order('created_at', { ascending: false }),

        // Paradas atualizadas
        supabase
          .from('paradas')
          .select('id, ordem, endereco, status, concluida_em')
          .eq('rota_id', rotaId)
          .not('concluida_em', 'is', null),

        // Incidentes
        supabase
          .from('incidentes')
          .select('id, categoria, descricao, created_at')
          .eq('rota_id', rotaId),
      ]);

      const timelineEvents: TimelineEvent[] = [];

      // Processar logs
      if (logsRes.data) {
        logsRes.data.forEach((log: any) => {
          const evento = log.evento.toLowerCase();

          // Detectar evento de início de rota
          if (evento.includes('iniciou') || evento.includes('start') || evento === 'motorista_iniciou_rota') {
            const detalhes = typeof log.detalhes === 'object' ? log.detalhes : null;
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.created_at,
              title: 'Rota Iniciada',
              description: detalhes?.timestamp
                ? `Motorista iniciou a rota às ${new Date(detalhes.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Motorista iniciou a rota',
              icon: 'play-circle',
              color: '#3b82f6',
            });
          }
          // Detectar evento de conclusão de rota
          else if (evento.includes('concluiu') || evento.includes('finaliz') || evento === 'motorista_concluiu_rota') {
            const detalhes = typeof log.detalhes === 'object' ? log.detalhes : null;
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.created_at,
              title: 'Rota Concluída',
              description: detalhes?.timestamp
                ? `Motorista finalizou a rota às ${new Date(detalhes.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Motorista finalizou a rota',
              icon: 'checkmark-circle',
              color: '#22c55e',
            });
          }
          // Detectar evento de cancelamento de rota
          else if (evento.includes('cancelou') || evento.includes('cancel') || evento === 'rota_cancelada') {
            const detalhes = typeof log.detalhes === 'object' ? log.detalhes : null;
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.created_at,
              title: 'Rota Cancelada',
              description: detalhes?.timestamp
                ? `Rota cancelada às ${new Date(detalhes.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Rota foi cancelada',
              icon: 'close-circle',
              color: '#ef4444',
            });
          }
        });
      }

      // Processar paradas concluídas
      if (paradasRes.data) {
        paradasRes.data.forEach((parada: any) => {
          if (parada.status === 'concluida') {
            timelineEvents.push({
              id: `parada-${parada.id}`,
              type: 'parada_update',
              timestamp: parada.concluida_em,
              title: `Parada #${parada.ordem} Concluída`,
              description: parada.endereco,
              icon: 'location',
              color: '#10b981',
            });
          } else if (parada.status === 'pulada') {
            timelineEvents.push({
              id: `parada-${parada.id}`,
              type: 'parada_update',
              timestamp: parada.concluida_em || new Date().toISOString(),
              title: `Parada #${parada.ordem} Pulada`,
              description: parada.endereco,
              icon: 'remove-circle',
              color: '#f97316',
            });
          }
        });
      }

      // Processar incidentes
      if (incidentesRes.data) {
        incidentesRes.data.forEach((incidente: any) => {
          const categoriaLabels: Record<string, string> = {
            accident: 'Acidente/Incidente',
            absent: 'Cliente ausente',
            wrong_address: 'Endereço incorreto',
            blocked: 'Acesso bloqueado',
            vehicle: 'Problema no veículo',
            other: 'Outros',
          };

          timelineEvents.push({
            id: `incidente-${incidente.id}`,
            type: 'incidente',
            timestamp: incidente.created_at,
            title: categoriaLabels[incidente.categoria] || 'Incidente',
            description: incidente.descricao,
            icon: 'alert-circle',
            color: '#ef4444',
          });
        });
      }

      // Ordenar por timestamp (mais recente primeiro)
      timelineEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setEvents(timelineEvents);
    } catch (error) {
      console.error('[RouteTimeline] Erro ao carregar timeline:', error);
    } finally {
      setLoading(false);
    }
  }, [rotaId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    if (!realtime) return;

    // Subscrever atualizações de logs
    const channel = supabase
      .channel(`route-timeline-${rotaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logs',
          filter: `rota_id=eq.${rotaId}`,
        },
        () => {
          // Recarregar timeline quando novo log for criado
          loadTimeline();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'paradas',
          filter: `rota_id=eq.${rotaId}`,
        },
        () => {
          loadTimeline();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidentes',
          filter: `rota_id=eq.${rotaId}`,
        },
        () => {
          loadTimeline();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rotaId, realtime, loadTimeline]);

  useEffect(() => {
    onStateChange?.({ loading, events: events.length });
  }, [loading, events.length, onStateChange]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text style={styles.loadingText}>Carregando timeline...</Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={48} color="#cbd5e1" />
        <Text style={styles.emptyText}>Nenhum evento registrado</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={Platform.OS === 'web'}>
      {events.map((event, index) => (
        <View key={event.id} style={styles.eventContainer}>
          {/* Timeline line */}
          {index < events.length - 1 && <View style={styles.timelineLine} />}

          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: event.color }]}>
            <Ionicons name={event.icon} size={20} color="#FFFFFF" />
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.timestamp}>{formatTimestamp(event.timestamp)}</Text>
            </View>
            <Text style={styles.description} numberOfLines={2}>
              {event.description}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  eventContainer: {
    flexDirection: 'row',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 24,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 35,
    top: 40,
    bottom: 0,
    width: 2,
    backgroundColor: '#e2e8f0',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 8,
  },
  description: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
});
