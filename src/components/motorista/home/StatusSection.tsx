import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text } from 'react-native';

import { ConnectivityIndicator } from '@/components/ConnectivityBanner';
import { RouteStatus } from '@/context/RouteStatusContext';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface StatusSectionProps {
  userName?: string;
  unitName?: string;
  userPhoto?: string | null;
  routeStatus?: RouteStatus;
  completedStops?: number;
  totalStops?: number;
  timeElapsed?: string;
}

// Configuração visual por status
// WCAG AA: 4.5:1 para texto normal, 3:1 para texto grande
const statusConfig: Record<RouteStatus, {
  icon: string;
  label: string;
  colorKey: 'success' | 'successDark' | 'warning' | 'warningText' | 'primary' | 'gray500' | 'info' | 'white';
  bgColorKey: 'successBg' | 'warningBg' | 'primaryLight' | 'gray100' | 'infoBg';
}> = {
  'no-route': {
    icon: 'cafe-outline',
    label: 'Sem rota',
    colorKey: 'gray500',
    bgColorKey: 'gray100',
  },
  'pending': {
    icon: 'time-outline',
    label: 'Rota pendente',
    colorKey: 'warningText', // #b45309 para contraste 5.1:1 em warningBg
    bgColorKey: 'warningBg',
  },
  'active': {
    icon: 'navigate',
    label: 'Em rota',
    colorKey: 'successDark', // #047857 para contraste 5.9:1 em successBg
    bgColorKey: 'successBg',
  },
  'last-stop': {
    icon: 'flag',
    label: 'Última parada',
    colorKey: 'white', // branco para contraste 4.6:1 em primaryLight
    bgColorKey: 'primaryLight',
  },
  'ready-to-complete': {
    icon: 'checkmark-circle',
    label: 'Pronto para finalizar',
    colorKey: 'successDark', // #047857 para contraste 5.9:1 em successBg
    bgColorKey: 'successBg',
  },
  'completed': {
    icon: 'trophy',
    label: 'Rota concluída',
    colorKey: 'info', // #3b82f6 mantido (contraste ~2.9:1 mas badge informativo)
    bgColorKey: 'infoBg',
  },
};

export function StatusSection({
  userName = 'Motorista',
  routeStatus = 'no-route',
  completedStops = 0,
  totalStops = 0,
  timeElapsed,
}: StatusSectionProps) {
  const { theme } = useUnistyles();
  const config = statusConfig[routeStatus];

  // Saudação baseada na hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Primeiro nome do usuário
  const firstName = userName.split(' ')[0];

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        {/* Greeting + Name (compacto) */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingText}>
            {getGreeting()}, <Text style={styles.nameText}>{firstName}</Text>
          </Text>
        </View>

        {/* Status badge + connectivity */}
        <View style={styles.rightContainer}>
          <ConnectivityIndicator />
          <View style={[
            styles.statusBadge,
            { backgroundColor: theme.colors[config.bgColorKey] }
          ]}>
            <Ionicons
              name={config.icon as any}
              size={14}
              color={theme.colors[config.colorKey]}
            />
            <Text style={[
              styles.statusText,
              { color: theme.colors[config.colorKey] }
            ]}>
              {config.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress indicator (only when active) */}
      {(routeStatus === 'active' || routeStatus === 'last-stop') && totalStops > 0 && (
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(completedStops / totalStops) * 100}%`,
                  backgroundColor: routeStatus === 'last-stop'
                    ? theme.colors.primaryLight
                    : theme.colors.success
                }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {completedStops}/{totalStops}
          </Text>
          {timeElapsed && (
            <Text style={styles.timeText}>· {timeElapsed}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md, // Reduzido de lg para md
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: theme.typography.base, // 16px
    color: theme.colors.gray600,
  },
  nameText: {
    fontSize: theme.typography.lg, // 18px
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 12, // WCAG mínimo legível
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm, // Reduzido de md para sm
    gap: theme.spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.gray200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.gray700,
    minWidth: 32,
    textAlign: 'right',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.gray500,
    marginLeft: theme.spacing.xs,
  },
}));
