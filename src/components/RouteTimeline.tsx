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
          .order('timestamp', { ascending: false }),

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
          const detalhes = typeof log.detalhes === 'object' ? log.detalhes : null;

          // Detectar evento de CRIAÇÃO de rota
          if (evento === 'rota_criada') {
            const totalParadas = detalhes?.total_paradas || 0;
            const temVinculos = detalhes?.tem_vinculos;
            let description = `Rota criada com ${totalParadas} parada(s)`;
            if (temVinculos) {
              description += ` • ${detalhes?.total_vinculos || 0} vínculo(s)`;
            }
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.timestamp,
              title: 'Rota Criada',
              description,
              icon: 'add-circle',
              color: '#8b5cf6', // roxo
            });
          }
          // Detectar evento de início de rota
          else if (evento.includes('iniciou') || evento.includes('start') || evento === 'motorista_iniciou_rota') {
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.timestamp,
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
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.timestamp,
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
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.timestamp,
              title: 'Rota Cancelada',
              description: detalhes?.timestamp
                ? `Rota cancelada às ${new Date(detalhes.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Rota foi cancelada',
              icon: 'close-circle',
              color: '#ef4444',
            });
          }
          // Detectar evento de PARADA REABERTA
          else if (evento === 'parada_reaberta') {
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'parada_update',
              timestamp: log.timestamp,
              title: 'Parada Reaberta',
              description: detalhes?.endereco || 'Parada voltou para pendente',
              icon: 'refresh-circle',
              color: '#f59e0b', // amarelo/laranja
            });
          }
          // Detectar evento de SOS ACIONADO (CRÍTICO)
          else if (evento === 'sos_acionado') {
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.timestamp,
              title: '🚨 SOS Acionado',
              description: detalhes?.motivo || 'Motorista acionou botão de emergência',
              icon: 'warning',
              color: '#dc2626', // vermelho intenso
            });
          }
          // Detectar evento de RESUMO CONFIRMADO (motorista viu o resumo final)
          else if (evento === 'rota_finalizada') {
            const concluidas = detalhes?.paradas_concluidas || 0;
            const puladas = detalhes?.paradas_puladas || 0;
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.timestamp,
              title: 'Resumo Confirmado',
              description: `${concluidas} concluída(s), ${puladas} pulada(s)`,
              icon: 'document-text',
              color: '#06b6d4', // ciano
            });
          }
          // Detectar evento de PARADA ADICIONADA (gestor adicionou parada)
          else if (evento === 'parada_adicionada') {
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'parada_update',
              timestamp: log.timestamp,
              title: 'Parada Adicionada',
              description: detalhes?.endereco || 'Nova parada adicionada à rota',
              icon: 'add-circle',
              color: '#22c55e', // verde
            });
          }
          // Detectar evento de PARADA EDITADA (gestor editou parada)
          else if (evento === 'parada_editada') {
            const camposAlterados = detalhes?.campos_alterados;
            let descricao = 'Parada foi editada';
            if (camposAlterados) {
              const campos: string[] = [];
              if (camposAlterados.endereco) campos.push('endereço');
              if (camposAlterados.destinatario) campos.push('destinatário');
              if (camposAlterados.telefone) campos.push('telefone');
              if (camposAlterados.tipo) campos.push('tipo');
              if (camposAlterados.observacoes) campos.push('observações');
              if (campos.length > 0) {
                descricao = `Alterado: ${campos.join(', ')}`;
              }
            }
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'parada_update',
              timestamp: log.timestamp,
              title: 'Parada Editada',
              description: descricao,
              icon: 'create',
              color: '#f59e0b', // amarelo
            });
          }
          // Detectar evento de PARADA REMOVIDA (gestor removeu parada)
          else if (evento === 'parada_removida') {
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'parada_update',
              timestamp: log.timestamp,
              title: 'Parada Removida',
              description: `${detalhes?.paradas_restantes || 0} parada(s) restante(s)`,
              icon: 'trash',
              color: '#ef4444', // vermelho
            });
          }
          // Detectar evento de MOTORISTA ALTERADO (gestor trocou motorista)
          else if (evento === 'motorista_alterado') {
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.timestamp,
              title: 'Motorista Alterado',
              description: detalhes?.motorista_novo_nome
                ? `Novo motorista: ${detalhes.motorista_novo_nome}`
                : 'Motorista da rota foi alterado',
              icon: 'person',
              color: '#8b5cf6', // roxo
            });
          }
          // Detectar evento de PARADAS REORDENADAS (gestor reordenou paradas)
          else if (evento === 'paradas_reordenadas') {
            timelineEvents.push({
              id: `log-${log.id}`,
              type: 'status_change',
              timestamp: log.timestamp,
              title: 'Rota Reordenada',
              description: detalhes?.alterado_por
                ? `Ordem alterada por ${detalhes.alterado_por}`
                : 'Ordem das paradas foi alterada',
              icon: 'swap-vertical',
              color: '#6366f1', // indigo
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
