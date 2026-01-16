/**
 * MainCardNoRoute - Content for no-route state
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '@/design-system';
import { MilestoneData } from '@/hooks/useMilestones';
import { getWorkContext } from '@/utils/motivationalMessages';
import { useUnistyles } from '@/utils/styles';

import { ExpiredRouteCard } from '../ExpiredRouteCard';
import { LastRouteCard } from '../LastRouteCard';
import { styles } from '../MainCard.styles';
import { MilestoneCard } from '../MilestoneCard';
import { NoRouteStatus } from '../NoRouteStatus';
import { WeeklyChart } from '../WeeklyChart';

import type { ExpiredRouteData, LastRouteData, NoRouteStats } from './MainCard.types';

interface MainCardNoRouteProps {
  stats: NoRouteStats;
  streak: number;
  lastRoute: LastRouteData | null;
  expiredRoute: ExpiredRouteData | null;
  expiredRouteDismissed: boolean;
  dismissExpiredRoute: () => void;
  milestoneData: MilestoneData;
}

export const MainCardNoRoute = memo(function MainCardNoRoute({
  stats,
  streak,
  lastRoute,
  expiredRoute,
  expiredRouteDismissed,
  dismissExpiredRoute,
  milestoneData,
}: MainCardNoRouteProps) {
  const { theme } = useUnistyles();
  const router = useRouter();

  const hasAnyStats = stats.rotasOntem > 0 || stats.paradasOntem > 0 || stats.rotasHoje > 0 || stats.paradasHoje > 0;
  const workContext = getWorkContext();

  const noRouteContext = {
    streak,
    rotasHoje: stats.rotasHoje,
    paradasHoje: stats.paradasHoje,
    isAboveAverage: milestoneData.averagePerDay > 0 && stats.paradasHoje > milestoneData.averagePerDay,
  };

  return (
    <View style={styles.content}>
      {/* Card de rota expirada */}
      {expiredRoute && !expiredRouteDismissed && (
        <ExpiredRouteCard
          data={expiredRoute}
          onDismiss={dismissExpiredRoute}
        />
      )}

      {/* STATUS PRINCIPAL */}
      <NoRouteStatus
        context={noRouteContext}
        showWaitingIndicator={workContext.isWorkHours}
      />

      {/* Separador visual */}
      {(hasAnyStats || milestoneData.nextMilestone || milestoneData.weeklyData.length > 0 || lastRoute || expiredRoute) && (
        <View style={styles.noRouteDivider} />
      )}

      {/* Card da última rota concluída hoje */}
      {lastRoute && workContext.isWorkHours && (
        <LastRouteCard data={lastRoute} />
      )}

      {/* Streak Badge */}
      {streak > 0 && workContext.isWorkHours && (
        <View style={[styles.streakBadge, { backgroundColor: theme.colors.warningBg }]}>
          <Ionicons name="flame" size={18} color={theme.colors.warning} />
          <Text style={[styles.streakText, { color: theme.colors.warningText }]}>
            {streak} {streak === 1 ? 'dia' : 'dias'} seguidos!
          </Text>
        </View>
      )}

      {/* Gráfico Semanal */}
      {milestoneData.weeklyData.length > 0 && workContext.isWorkDay && (
        <WeeklyChart
          data={milestoneData.weeklyData}
          averagePerDay={milestoneData.averagePerDay}
          isLoading={milestoneData.isLoading}
          compact
        />
      )}

      {/* Card de Milestone */}
      {milestoneData.nextMilestone && workContext.isWorkDay && (
        <MilestoneCard data={milestoneData} compact />
      )}

      {/* Stats comparativos (HOJE vs ONTEM) */}
      {hasAnyStats && workContext.isWorkHours && (
        <View style={styles.statsComparison}>
          {/* Coluna HOJE */}
          <View style={styles.statsColumn}>
            <Text style={[styles.statsColumnHeader, { color: theme.colors.primary }]}>HOJE</Text>
            <View style={styles.statsColumnContent}>
              <View style={styles.miniStat}>
                <Ionicons name="map-outline" size={14} color={theme.colors.gray500} />
                <Text style={styles.miniStatValue}>
                  {stats.rotasHoje} {stats.rotasHoje === 1 ? 'rota' : 'rotas'}
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Ionicons name="location-outline" size={14} color={theme.colors.gray500} />
                <Text style={styles.miniStatValue}>
                  {stats.paradasHoje > 0 ? `${stats.paradasHoje} paradas` : '--'}
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Ionicons name="speedometer-outline" size={14} color={theme.colors.gray500} />
                <Text style={styles.miniStatValue}>
                  {stats.distanciaHoje > 0 ? `${stats.distanciaHoje} km` : '--'}
                </Text>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.statsDivider} />

          {/* Coluna ONTEM */}
          <View style={styles.statsColumn}>
            <Text style={[styles.statsColumnHeader, { color: theme.colors.gray500 }]}>ONTEM</Text>
            <View style={styles.statsColumnContent}>
              <View style={styles.miniStat}>
                <Ionicons name="map-outline" size={14} color={theme.colors.gray400} />
                <Text style={[styles.miniStatValue, { color: theme.colors.gray600 }]}>
                  {stats.rotasOntem > 0 ? `${stats.rotasOntem} ${stats.rotasOntem === 1 ? 'rota' : 'rotas'}` : '--'}
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Ionicons name="location-outline" size={14} color={theme.colors.gray400} />
                <Text style={[styles.miniStatValue, { color: theme.colors.gray600 }]}>
                  {stats.paradasOntem > 0 ? `${stats.paradasOntem} paradas` : '--'}
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Ionicons name="speedometer-outline" size={14} color={theme.colors.gray400} />
                <Text style={[styles.miniStatValue, { color: theme.colors.gray600 }]}>
                  {stats.distanciaOntem > 0 ? `${stats.distanciaOntem} km` : '--'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Links rápidos */}
      {workContext.isWorkHours && (
        <View style={styles.quickLinks}>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/motorista/historico')}
          >
            <Ionicons name="time-outline" size={16} color={theme.colors.gray500} />
            <Text style={styles.quickLinkText}>Ver histórico</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/motorista/desempenho')}
          >
            <Ionicons name="stats-chart-outline" size={16} color={theme.colors.gray500} />
            <Text style={styles.quickLinkText}>Ver desempenho</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});
