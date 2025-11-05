import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Platform } from 'react-native';
import { useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import type { DashboardData } from '../../dashboard/_hooks/useDashboardData';
import { StatsCard } from '../shared/StatsCard';
import { RotasTable } from './RotasTable';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Toast } from '@/components/Toast';

interface DashboardDesktopProps extends DashboardData {}

/**
 * Layout desktop do Dashboard do Gestor
 * Sidebar gerenciada pelo gestor/_layout.tsx (persistente entre navegações)
 */
export function DashboardDesktop({
  stats,
  rotas,
  loading,
  refreshing,
  onRefresh,
}: DashboardDesktopProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { userData } = useUser();

  // Estado para modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rotaToDelete, setRotaToDelete] = useState<string | null>(null);

  // Estado para toast de feedback
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ visible: true, message, type });
  };

  const handleDeleteRota = async (rotaId: string) => {
    // Web: usar modal customizado
    if (Platform.OS === 'web') {
      setRotaToDelete(rotaId);
      setShowConfirmModal(true);
    } else {
      // Mobile: usar Alert.alert nativo
      Alert.alert(
        'Confirmar Exclusão',
        'Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: () => executeDelete(rotaId),
          },
        ]
      );
    }
  };

  const executeDelete = async (rotaId: string) => {
    try {
      const { error } = await supabase
        .from('rotas')
        .delete()
        .eq('id', rotaId);

      if (error) throw error;

      if (Platform.OS === 'web') {
        showToast('Rota excluída com sucesso', 'success');
      } else {
        Alert.alert('Sucesso', 'Rota excluída com sucesso');
      }

      onRefresh(); // Refresh the dashboard
    } catch (error) {
      console.error('Erro ao excluir rota:', error);

      if (Platform.OS === 'web') {
        showToast('Erro ao excluir a rota', 'error');
      } else {
        Alert.alert('Erro', 'Não foi possível excluir a rota');
      }
    }
  };

  const handleConfirmDelete = () => {
    setShowConfirmModal(false);
    if (rotaToDelete) {
      executeDelete(rotaToDelete);
      setRotaToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmModal(false);
    setRotaToDelete(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primaryDark} />
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>
                Dashboard
              </Text>
              <Text style={styles.headerSubtitle}>
                {userData?.unidades?.nome}
              </Text>
            </View>
            <View style={styles.userSection}>
              <Text style={styles.userGreeting}>
                Olá, <Text style={styles.userName}>{userData?.nome}</Text>
              </Text>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {userData?.nome?.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Stats Cards - Grid 4x1 Horizontal */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <StatsCard
                value={stats.total}
                label="Total Hoje"
                backgroundColor={theme.colors.primaryDark}
              />
            </View>
            <View style={styles.statCard}>
              <StatsCard
                value={stats.emAndamento}
                label="Em Andamento"
                backgroundColor={theme.colors.secondary}
              />
            </View>
            <View style={styles.statCard}>
              <StatsCard
                value={stats.concluidas}
                label="Concluídas"
                backgroundColor={theme.colors.success}
              />
            </View>
            <View style={styles.statCard}>
              <StatsCard
                value={stats.distanciaTotal.toFixed(1)}
                label="km Total"
                backgroundColor={theme.colors.purple}
              />
            </View>
          </View>

          {/* Ações Rápidas - Horizontal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Ações Rápidas
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => router.push('/gestor/nova-entrega')}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionText}>
                  + Nova Rota de Entrega
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => router.push('/gestor/motoristas')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryActionText}>
                  👥 Gerenciar Motoristas
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => router.push('/gestor/historico')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryActionText}>
                  📋 Ver Histórico
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabela de Rotas */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Rotas de Hoje
            </Text>
            <RotasTable
              rotas={rotas}
              onRotaPress={(rotaId) => {
                router.push(`/gestor/mapa-rota?id=${rotaId}`);
              }}
              onDeletePress={handleDeleteRota}
            />
          </View>
        </View>
      </ScrollView>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        visible={showConfirmModal}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Toast de Feedback */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
    </>
  );
}

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  header: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  userGreeting: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray700,
  },
  userName: {
    fontFamily: theme.typography.fontSansSemiBold,
  },
  userAvatar: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: theme.colors.white,
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
  },
  content: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  statCard: {
    flex: 1,
  },
  section: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  primaryActionText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.base,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.base,
  },
}));
