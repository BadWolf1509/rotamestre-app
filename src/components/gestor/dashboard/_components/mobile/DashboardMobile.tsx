import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';

import { RouteFilters } from '@/components/RouteFilters';
import type { RouteFiltersState as RouteFiltersType } from '@/components/RouteFilters';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
// REMOVIDO: import { useUser } from '@/hooks/useUser'; // Agora recebe userData como prop
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { RotaCard } from '../shared/RotaCard';
import { StatsCard } from '../shared/StatsCard';

import type { DashboardData } from '../../_hooks/useDashboardData';

interface DashboardMobileProps extends DashboardData {
  filters: RouteFiltersType;
  onFiltersChange: (filters: RouteFiltersType) => void;
}

/**
 * Layout mobile do Dashboard do Gestor
 * Usa ScrollView vertical com cards empilhados
 */
export function DashboardMobile({
  stats,
  todayStats, // ✅ Stats de hoje (ignora filtros)
  rotas,
  loading,
  refreshing,
  onRefresh,
  userData, // Receber userData como prop ao invés de usar useUser
  filters,
  onFiltersChange,
}: DashboardMobileProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  // REMOVIDO: const { userData } = useUser(); // Evitar chamada duplicada
  const { toast: toastState, hideToast } = useToast();

  // Carregar lista de motoristas para o filtro
  const [motoristas, setMotoristas] = useState<Array<{ id: string; nome: string }>>([]);

  useEffect(() => {
    const loadMotoristas = async () => {
      if (!userData?.unidade_id) return;

      const { data } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('unidade_id', userData.unidade_id)
        .eq('papel', 'motorista')
        .order('nome');

      if (data) {
        setMotoristas(data);
      }
    };

    loadMotoristas();
  }, [userData?.unidade_id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primaryDark} />
        <Text style={styles.loadingText}>Carregando início...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID="dashboard-scroll-view"
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            Olá, {userData?.nome}!
          </Text>
          <Text style={styles.headerSubtitle}>
            {userData?.unidades?.nome}
          </Text>
        </View>
      </View>

      {/* Cards de Estatísticas - Grid 2x2 */}
      <View style={styles.statsGrid}>
        <View style={styles.statsCardWrapper}>
          <StatsCard
            value={todayStats.totalHoje}
            label="Total Hoje"
            backgroundColor={theme.colors.primaryDark}
          />
        </View>
        <View style={styles.statsCardWrapper}>
          <StatsCard
            value={stats.emAndamento}
            label="Em Andamento"
            backgroundColor={theme.colors.secondary}
          />
        </View>
        <View style={styles.statsCardWrapper}>
          <StatsCard
            value={stats.concluidas}
            label="Concluídas"
            backgroundColor={theme.colors.kpiConcluidas}
          />
        </View>
        <View style={styles.statsCardWrapper}>
          <StatsCard
            value={stats.distanciaTotal.toFixed(1)}
            label="km Total"
            backgroundColor={theme.colors.kpiDistancia}
          />
        </View>
        <TouchableOpacity
          style={styles.statsCardWrapper}
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

      {/* Ações Rápidas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Ações Rápidas
        </Text>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/gestor/nova-entrega')}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="add-circle" size={20} color={theme.colors.white} />
              <Text style={styles.primaryButtonText}>
                Nova Rota de Entrega
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/gestor/motoristas')}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="people" size={20} color={theme.colors.primary} />
              <Text style={styles.secondaryButtonText}>
                Gerenciar Motoristas
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/gestor/gestao-rotas')}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="clipboard" size={20} color={theme.colors.primary} />
              <Text style={styles.secondaryButtonText}>
                Gestão de Rotas
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rotas de Hoje */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Rotas de Hoje
        </Text>

        {rotas.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>
              Nenhuma rota cadastrada hoje
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              Crie sua primeira rota de entrega
            </Text>
          </View>
        ) : (
          rotas.map((rota) => (
            <RotaCard
              key={rota.id}
              rota={rota}
              onPress={() => {
                router.push(`/gestor/mapa-rota?id=${rota.id}`);
              }}
            />
          ))
        )}
      </View>

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />

      {/* Floating Filter Button */}
      <RouteFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        motoristas={motoristas}
        variant="mobile"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
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
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTextContainer: {
    width: '100%',
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  statsCardWrapper: {
    width: '48%',
  },
  section: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
  },
  actionsContainer: {
    gap: theme.spacing.sm,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.base,
  },
  secondaryButton: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.base,
  },
  emptyState: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['3xl'],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: theme.typography.base,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
}));
