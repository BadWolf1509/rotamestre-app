import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View, TouchableOpacity, RefreshControl } from 'react-native';

import { AnimatedListItem } from '@/components/AnimatedListItem';
import { RouteFilters } from '@/components/RouteFilters';
import type { RouteFiltersState as RouteFiltersType } from '@/components/RouteFilters';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  Button,
  DesktopPageLayout,
  Dialog,
  Text,
  Toast,
} from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useMotoristas } from '@/hooks/useMotoristas';
import { formatarDecimal } from '@/lib/formatNumber';
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

  // Memoize showToast para evitar recriação
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info') => {
      setToast({ visible: true, message, type });
    },
    [],
  );

  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  // Memoize delete handler para evitar re-render do RotasTable
  const handleDeleteRota = useCallback((rotaId: string) => {
    // Usar ConfirmModal em todas as plataformas para UX consistente
    setRotaToDelete(rotaId);
    setShowConfirmModal(true);
  }, []);

  // Memoize execute delete
  const executeDelete = useCallback(
    async (rotaId: string) => {
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
    },
    [showToast, onRefresh],
  );

  // Memoize confirm handler
  const handleConfirmDelete = useCallback(() => {
    setShowConfirmModal(false);
    if (rotaToDelete) {
      executeDelete(rotaToDelete);
      setRotaToDelete(null);
    }
  }, [rotaToDelete, executeDelete]);

  // Memoize cancel handler
  const handleCancelDelete = useCallback(() => {
    setShowConfirmModal(false);
    setRotaToDelete(null);
  }, []);

  // Memoize view details handler
  const handleViewDetails = useCallback(
    (rotaId: string) => {
      router.push(`/gestor/mapa-rota?id=${rotaId}`);
    },
    [router],
  );

  // Memoize toast dismiss
  const handleToastDismiss = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

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
            <AnimatedListItem index={0} style={styles.statCard}>
              <StatsCard
                value={todayStats.totalHoje}
                label="Total Hoje"
                backgroundColor={theme.colors.primaryDark}
              />
            </AnimatedListItem>
            <AnimatedListItem index={1} style={styles.statCard}>
              <StatsCard
                value={stats.emAndamento}
                label="Em Andamento"
                backgroundColor={theme.colors.secondary}
              />
            </AnimatedListItem>
            <AnimatedListItem index={2} style={styles.statCard}>
              <StatsCard
                value={stats.concluidas}
                label="Concluídas"
                backgroundColor={theme.colors.kpiConcluidas}
              />
            </AnimatedListItem>
            <AnimatedListItem index={3} style={styles.statCard}>
              <StatsCard
                value={formatarDecimal(stats.distanciaTotal)}
                label="km Total"
                backgroundColor={theme.colors.kpiDistancia}
              />
            </AnimatedListItem>
            <AnimatedListItem index={4} style={styles.statCard}>
              <TouchableOpacity
                onPress={() => router.push('/gestor/incidentes')}
                activeOpacity={0.8}
              >
                <StatsCard
                  value={stats.incidentesAbertos || 0}
                  label="Incidentes Abertos"
                  backgroundColor={theme.colors.kpiIncidentes}
                />
              </TouchableOpacity>
            </AnimatedListItem>
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
            onViewDetails={handleViewDetails}
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
        onDismiss={handleToastDismiss}
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
