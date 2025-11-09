import { useRouter } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';

import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { StyleSheet, useUnistyles } from '@/utils/styles';

import { RotaCard } from '../shared/RotaCard';
import { StatsCard } from '../shared/StatsCard';

import type { DashboardData } from '../../dashboard/_hooks/useDashboardData';

interface DashboardMobileProps extends DashboardData {}

/**
 * Layout mobile do Dashboard do Gestor
 * Usa ScrollView vertical com cards empilhados
 */
export function DashboardMobile({
  stats,
  rotas,
  loading,
  refreshing,
  onRefresh,
}: DashboardMobileProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { userData } = useUser();
  const { toast: toastState, hideToast } = useToast();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primaryDark} />
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
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
            value={stats.total}
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
            backgroundColor={theme.colors.success}
          />
        </View>
        <View style={styles.statsCardWrapper}>
          <StatsCard
            value={stats.distanciaTotal.toFixed(1)}
            label="km Total"
            backgroundColor={theme.colors.purple}
          />
        </View>
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
            <Text style={styles.primaryButtonText}>
              + Nova Rota de Entrega
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/gestor/motoristas')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>
              👥 Gerenciar Motoristas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/gestor/historico')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>
              📋 Ver Histórico
            </Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create(theme => ({
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
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
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
  primaryButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  primaryButtonText: {
    color: theme.colors.white,
    textAlign: 'center',
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.base,
  },
  secondaryButton: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  secondaryButtonText: {
    color: theme.colors.gray900,
    textAlign: 'center',
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
