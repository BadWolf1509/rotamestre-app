import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';

import { ConfirmModal } from '@/components/ConfirmModal';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { Toast } from '@/components/Toast';
// REMOVIDO: import { useUser } from '@/hooks/useUser'; // Agora recebe userData como prop
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles } from '@/utils/styles';



import { RotasTable } from './RotasTable';
import { StatsCard } from '../shared/StatsCard';

import type { DashboardData } from '../../dashboard/_hooks/useDashboardData';


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
  userData, // Receber userData como prop ao invés de usar useUser
}: DashboardDesktopProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  // REMOVIDO: const { userData } = useUser(); // Evitar chamada duplicada

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

  const headerExtra = (
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
  );

  return (
    <>
      <DesktopPageLayout
        title="Dashboard"
        subtitle={userData?.unidades?.nome || ''}
        headerExtra={headerExtra}
        loading={loading}
        scrollViewProps={{
          refreshControl: (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ),
        }}
      >
        <View style={styles.content}>
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ações Rápidas</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => router.push('/gestor/nova-entrega')}
              >
                <Text style={styles.primaryActionText}>+ Nova Rota de Entrega</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => router.push('/gestor/motoristas')}
              >
                <Text style={styles.secondaryActionText}>Gerenciar Motoristas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => router.push('/gestor/historico')}
              >
                <Text style={styles.secondaryActionText}>Ver Histórico</Text>
              </TouchableOpacity>
            </View>
          </View>

          <RotasTable
            rotas={rotas}
            onViewDetails={(rotaId) => router.push(`/gestor/mapa-rota?id=${rotaId}`)}
            onDelete={handleDeleteRota}
          />
        </View>
      </DesktopPageLayout>

      <ConfirmModal
        visible={showConfirmModal}
        title="Excluir Rota"
        message="Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        type="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

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
