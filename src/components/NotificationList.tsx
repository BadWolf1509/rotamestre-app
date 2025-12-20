import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNotifications } from '@/hooks/useNotifications';
import type { NotificacaoComDetalhes } from '@/types/notifications';

interface NotificationListProps {
  onClose: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const { notificacoes, naoLidas, loading, marcarComoLida, marcarTodasComoLidas } =
    useNotifications();

  const handleNotificationPress = (notificacao: NotificacaoComDetalhes) => {
    // Marcar como lida
    if (!notificacao.lida) {
      marcarComoLida(notificacao.id);
    }

    // Navegar para a tela relevante
    if (notificacao.rota_id) {
      onClose();
      router.push(`/gestor/mapa-rota?id=${notificacao.rota_id}`);
    }
  };

  const handleMarcarTodasLidas = () => {
    marcarTodasComoLidas();
  };

  const getNotificationIcon = (tipo: string) => {
    switch (tipo) {
      case 'rota_iniciada':
        return 'play-circle';
      case 'rota_concluida':
        return 'checkmark-circle';
      case 'parada_concluida':
        return 'location';
      case 'incidente_reportado':
        return 'alert-circle';
      case 'rota_atrasada':
        return 'time';
      case 'parada_pulada':
        return 'close-circle';
      case 'sos_acionado':
        return 'warning';
      case 'parada_reaberta':
        return 'refresh-circle';
      case 'nova_rota_atribuida':
        return 'car';
      case 'rota_nao_executada':
        return 'alert-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationIconColor = (tipo: string) => {
    switch (tipo) {
      case 'rota_iniciada':
        return '#3b82f6'; // blue
      case 'rota_concluida':
        return '#22c55e'; // green
      case 'parada_concluida':
        return '#10b981'; // emerald
      case 'incidente_reportado':
        return '#ef4444'; // red
      case 'rota_atrasada':
        return '#f59e0b'; // amber
      case 'parada_pulada':
        return '#f97316'; // orange
      case 'sos_acionado':
        return '#dc2626'; // red-600 (emergência)
      case 'parada_reaberta':
        return '#f59e0b'; // amber
      case 'nova_rota_atribuida':
        return '#FF8C42'; // primary (laranja)
      case 'rota_nao_executada':
        return '#f59e0b'; // amber (aviso)
      default:
        return '#64748b'; // gray
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const renderNotification = ({ item }: { item: NotificacaoComDetalhes }) => (
    <Pressable
      style={({ pressed }) => [
        styles.notificationItem,
        !item.lida && styles.unread,
        pressed && styles.pressed,
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={getNotificationIcon(item.tipo) as any}
          size={24}
          color={getNotificationIconColor(item.tipo)}
        />
        {!item.lida && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.content}>
        <Text style={[styles.titulo, !item.lida && styles.tituloUnread]}>{item.titulo}</Text>
        <Text style={styles.mensagem} numberOfLines={2}>
          {item.mensagem}
        </Text>
        <Text style={styles.timestamp}>{formatTimestamp(item.created_at)}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notificações</Text>
          {naoLidas > 0 && <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{naoLidas}</Text>
          </View>}
        </View>

        <View style={styles.headerActions}>
          {naoLidas > 0 && (
            <Pressable onPress={handleMarcarTodasLidas} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Marcar todas como lidas</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={styles.closeButton} testID="close-button">
            <Ionicons name="close" size={24} color="#64748b" />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#284093" />
        </View>
      ) : notificacoes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>Nenhuma notificação</Text>
          <Text style={styles.emptySubtext}>
            Você será notificado sobre atualizações nas rotas
          </Text>
        </View>
      ) : Platform.OS === 'web' ? (
        <ScrollView style={styles.scrollView}>
          {notificacoes.map((item) => (
            <View key={item.id}>{renderNotification({ item })}</View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={notificacoes}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerButtonText: {
    color: '#284093',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  unread: {
    backgroundColor: '#f0f9ff',
  },
  pressed: {
    backgroundColor: '#e0f2fe',
  },
  iconContainer: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  tituloUnread: {
    fontWeight: '700',
    color: '#0f172a',
  },
  mensagem: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
