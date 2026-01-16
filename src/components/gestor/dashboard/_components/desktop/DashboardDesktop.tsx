import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View, TouchableOpacity, RefreshControl } from 'react-native';

import { RouteFilters } from '@/components/RouteFilters';
import type { RouteFiltersState as RouteFiltersType } from '@/components/RouteFilters';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { Button, DesktopPageLayout, Dialog, Text, Toast } from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useMotoristas } from '@/hooks/useMotoristas';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';



import { RotasTable } from './RotasTable';
import { StatsCard } from '../shared/StatsCard';

import type { DashboardData } from '../../_hooks/useDashboardData';


interface DashboardDesktopProps extends DashboardData {
  filters: RouteFiltersType;
  onFiltersChange: (filters: RouteFiltersType) => void;
}

/**
 * Layout desktop do Dashboard do Gestor
 * Sidebar gerenciada pelo gestor/_layout.tsx (persistente entre navegações)
 */
export function DashboardDesktop({
  stats,
  todayStats, // ✅ Stats de hoje (ignora filtros)
  kpis: _kpis, // ✅ KPIs avançados
  rotas,
  loading,
  refreshing,
  onRefresh,
  userData, // Receber userData como prop ao invés de usar useUser
  filters,
  onFiltersChange,
}: DashboardDesktopProps) {
  const { theme } = useUnistyles();
  const router = useRouter();

  const pageMeta = getGestorPageMeta('inicio');

  // ✅ Usar hook com cache para motoristas (evita recarregar a cada navegação)
  const { motoristas } = useMotoristas();

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

  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  const handleDeleteRota = async (rotaId: string) => {
    // Usar ConfirmModal em todas as plataformas para UX consistente
    setRotaToDelete(rotaId);
    setShowConfirmModal(true);
  };

  const executeDelete = async (rotaId: string) => {
    try {
      const { error } = await supabase
        .from('rotas')
        .delete()
        .eq('id', rotaId);

      if (error) throw error;

      showToast('Rota excluída com sucesso', 'success');
      onRefresh();
    } catch (error) {
      logger.error('Erro ao excluir rota:', error);
      showToast('Erro ao excluir a rota', 'error');
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

  return (
    <>
      <DesktopPageLayout
        title={pageMeta.title}
        subtitle={userData?.unidades?.nome || pageMeta.subtitle}
        breadcrumbs={pageMeta.breadcrumbs}
        userMenuTrigger={userMenuTrigger}
        userMenuItems={userMenuItems}
        loading={loading}
        scrollViewProps={{
          refreshControl: (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ),
        }}
      >
        <View style={styles.content}>
        <View style={styles.statsRow} testID="gestor-dashboard-stats">
            <View style={styles.statCard}>
              <StatsCard
                value={todayStats.totalHoje}
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
                backgroundColor={theme.colors.kpiConcluidas}
              />
            </View>
            <View style={styles.statCard}>
              <StatsCard
                value={stats.distanciaTotal.toFixed(1)}
                label="km Total"
                backgroundColor={theme.colors.kpiDistancia}
              />
            </View>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push('/gestor/incidentes')}
              activeOpacity={0.8}
            >
              <StatsCard
                value={stats.incidentesAbertos || 0}
                label="Incidentes Abertos"
                backgroundColor={theme.colors.kpiIncidentes}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ações Rápidas</Text>
            <View style={styles.actionsRow}>
              <Button
                title="Nova Rota de Entrega"
                icon="add-circle"
                variant="primary"
                onPress={() => router.push('/gestor/nova-entrega')}
                style={styles.actionButton}
              />
              <Button
                title="Gerenciar Motoristas"
                icon="people"
                variant="outline"
                onPress={() => router.push('/gestor/motoristas')}
                style={styles.actionButton}
              />
              <Button
                title="Gestão de Rotas"
                icon="clipboard"
                variant="outline"
                onPress={() => router.push('/gestor/gestao-rotas')}
                style={styles.actionButton}
              />
            </View>
          </View>

          <View style={styles.filtersSection}>
            <RouteFilters
              filters={filters}
              onFiltersChange={onFiltersChange}
              motoristas={motoristas}
              variant="desktop"
            />
          </View>

          <RotasTable
            rotas={rotas}
            onViewDetails={(rotaId) => router.push(`/gestor/mapa-rota?id=${rotaId}`)}
            onDelete={handleDeleteRota}
          />
        </View>
      </DesktopPageLayout>

      <Dialog
        visible={showConfirmModal}
        variant="confirm"
        title="Excluir Rota"
        message="Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
      {logoutModal}
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
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
  filtersSection: {
    marginBottom: theme.spacing['2xl'],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
}));
