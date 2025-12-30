import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useNotifications } from '@/hooks/useNotifications';
import { useUser } from '@/hooks/useUser';
import type { NotificacaoComDetalhes } from '@/types/notifications';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface NotificationListProps {
  onClose: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const { notificacoes, naoLidas, loading, marcarComoLida, marcarTodasComoLidas } =
    useNotifications();
  const { userData } = useUser();
  const { theme } = useUnistyles();

  /**
   * Determina a rota de navegação baseada no tipo de notificação e papel do usuário
   *
   * MOTORISTA:
   * - nova_rota_atribuida → /motorista (ver nova rota na tela inicial)
   * - lembrete_rota_pendente → /motorista (iniciar rota pendente)
   * - lembrete_rota_urgente → /motorista (urgente: iniciar rota!)
   * - rota_nao_executada → /motorista/historico (rota expirada está no histórico)
   *
   * GESTOR:
   * - Todas as notificações → /gestor/mapa-rota?id= (ver detalhes da rota)
   */
  const getNavigationPath = (tipo: string, rotaId: string): string => {
    if (userData?.papel === 'motorista') {
      // Tipos que direcionam para histórico (rotas finalizadas/expiradas)
      if (tipo === 'rota_nao_executada') {
        return '/motorista/historico';
      }
      // Todos os outros tipos direcionam para tela inicial
      // (nova_rota_atribuida, lembrete_rota_pendente, lembrete_rota_urgente)
      return '/motorista';
    }

    // Gestor: sempre vai para detalhes da rota
    return `/gestor/mapa-rota?id=${rotaId}`;
  };

  const handleNotificationPress = (notificacao: NotificacaoComDetalhes) => {
    // Marcar como lida
    if (!notificacao.lida) {
      marcarComoLida(notificacao.id);
    }

    // Navegar para a tela relevante
    if (notificacao.rota_id) {
      onClose();
      const path = getNavigationPath(notificacao.tipo, notificacao.rota_id);
      router.push(path as any);
    }
  };

  const handleMarcarTodasLidas = () => {
    marcarTodasComoLidas();
  };

  const getNotificationIcon = (tipo: string) => {
    switch (tipo) {
      // Notificações para GESTOR
      case 'rota_iniciada':
        return 'play-circle';
      case 'rota_concluida':
        return 'checkmark-circle';
      case 'parada_concluida':
        return 'location';
      case 'parada_pulada':
        return 'close-circle';
      case 'parada_reaberta':
        return 'refresh-circle';
      case 'incidente_reportado':
        return 'alert-circle';
      case 'sos_acionado':
        return 'warning';
      case 'rota_atrasada':
        return 'time';
      // Notificações para MOTORISTA
      case 'nova_rota_atribuida':
        return 'car';
      case 'lembrete_rota_pendente':
        return 'alarm';
      case 'lembrete_rota_urgente':
        return 'alarm';
      // Notificação para AMBOS
      case 'rota_nao_executada':
        return 'alert-circle';
      // Notificações de edição de rota (gestor editou)
      case 'rota_parada_adicionada':
        return 'add-circle';
      case 'rota_parada_removida':
        return 'remove-circle';
      case 'rota_parada_editada':
        return 'create';
      case 'rota_reordenada':
        return 'swap-vertical';
      default:
        return 'notifications';
    }
  };

  const getNotificationIconColor = (tipo: string) => {
    switch (tipo) {
      case 'rota_iniciada':
        return theme.colors.info;
      case 'rota_concluida':
        return theme.colors.success;
      case 'parada_concluida':
        return theme.colors.success;
      case 'parada_pulada':
        return theme.colors.orange;
      case 'parada_reaberta':
        return theme.colors.warning;
      case 'incidente_reportado':
        return theme.colors.error;
      case 'sos_acionado':
        return theme.colors.error;
      case 'rota_atrasada':
        return theme.colors.warning;
      case 'nova_rota_atribuida':
        return theme.colors.secondary;
      case 'lembrete_rota_pendente':
        return theme.colors.info;
      case 'lembrete_rota_urgente':
        return theme.colors.error;
      case 'rota_nao_executada':
        return theme.colors.warning;
      case 'rota_parada_adicionada':
        return theme.colors.success;
      case 'rota_parada_removida':
        return theme.colors.error;
      case 'rota_parada_editada':
        return theme.colors.info;
      case 'rota_reordenada':
        return theme.colors.purple;
      default:
        return theme.colors.gray500;
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

      <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
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
            <Ionicons name="close" size={24} color={theme.colors.gray500} />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : notificacoes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color={theme.colors.gray300} />
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

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerTitle: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.gray900,
  },
  headerBadge: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs / 2,
    minWidth: 24,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansBold,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
  },
  headerButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  closeButton: {
    padding: theme.spacing.xs,
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
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  unread: {
    backgroundColor: theme.colors.blue50,
  },
  pressed: {
    backgroundColor: theme.colors.blue100,
  },
  iconContainer: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray50,
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
    backgroundColor: theme.colors.error,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  content: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  titulo: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  tituloUnread: {
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  mensagem: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  timestamp: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray400,
    marginTop: theme.spacing.xs / 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['4xl'],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['4xl'],
    gap: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray400,
    textAlign: 'center',
  },
}));
