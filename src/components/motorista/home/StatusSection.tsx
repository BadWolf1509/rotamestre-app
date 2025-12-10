import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Image } from 'react-native';

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
}

// Configuração visual por status
const statusConfig: Record<RouteStatus, {
  icon: string;
  label: string;
  colorKey: 'success' | 'warning' | 'primary' | 'gray500' | 'info';
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
    colorKey: 'warning',
    bgColorKey: 'warningBg',
  },
  'active': {
    icon: 'navigate',
    label: 'Em rota',
    colorKey: 'success',
    bgColorKey: 'successBg',
  },
  'last-stop': {
    icon: 'flag',
    label: 'Última parada',
    colorKey: 'primary',
    bgColorKey: 'primaryLight',
  },
  'ready-to-complete': {
    icon: 'checkmark-circle',
    label: 'Pronto para finalizar',
    colorKey: 'success',
    bgColorKey: 'successBg',
  },
  'completed': {
    icon: 'trophy',
    label: 'Rota concluída',
    colorKey: 'info',
    bgColorKey: 'infoBg',
  },
};

export function StatusSection({
  userName = 'Motorista',
  unitName,
  userPhoto,
  routeStatus = 'no-route',
  completedStops = 0,
  totalStops = 0,
}: StatusSectionProps) {
  const { theme } = useUnistyles();
  const config = statusConfig[routeStatus];

  // Primeira letra do nome para avatar fallback
  const initials = userName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Saudação baseada na hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {/* Status indicator dot */}
          <View style={[
            styles.statusDot,
            { backgroundColor: theme.colors[config.colorKey] }
          ]} />
        </View>

        {/* Greeting and name */}
        <View style={styles.textContainer}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>{userName.split(' ')[0]}</Text>
          {unitName && (
            <Text style={styles.unitName}>{unitName}</Text>
          )}
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
                { width: `${(completedStops / totalStops) * 100}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {completedStops}/{totalStops}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: theme.colors.gray200,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  textContainer: {
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greeting: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  userName: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
    marginTop: -2,
  },
  unitName: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: 2,
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
    fontSize: 11,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
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
    backgroundColor: theme.colors.success,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.gray700,
    minWidth: 32,
    textAlign: 'right',
  },
}));
