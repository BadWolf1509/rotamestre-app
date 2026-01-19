import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteStatus } from '@/context/RouteStatusContext';
import type { IconName } from '@/types/icons';
import { lightHaptic, mediumHaptic, heavyHaptic } from '@/utils/haptics';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface QuickActionsProps {
  state: RouteStatus;
  onViewAllStops?: () => void;
  onContactSupport?: () => void;
  onReportIncident?: () => void;
  onOpenSettings?: () => void;
  onViewSummary?: () => void;
  onViewHistory?: () => void;
  style?: StyleProp<ViewStyle>;
}


interface ActionConfig {
  icon: IconName;
  label: string;
  onPress?: () => void;
  haptic: 'light' | 'medium' | 'heavy';
  color?: string;
}

export function QuickActions({
  state,
  onViewAllStops,
  onContactSupport,
  onReportIncident,
  onOpenSettings,
  onViewSummary,
  onViewHistory,
  style,
}: QuickActionsProps) {
  const { theme } = useUnistyles();

  const getActions = (): ActionConfig[] => {
    switch (state) {
      case 'no-route':
        return [
          { icon: 'time-outline', label: 'Histórico', onPress: onViewHistory, haptic: 'light' },
          { icon: 'bar-chart-outline', label: 'Estatísticas', onPress: onViewSummary, haptic: 'light' },
          { icon: 'settings-outline', label: 'Configurações', onPress: onOpenSettings, haptic: 'light' },
          { icon: 'help-circle-outline', label: 'Suporte', onPress: onContactSupport, haptic: 'light' },
        ];

      case 'pending':
        return [
          { icon: 'list-outline', label: 'Ver Paradas', onPress: onViewAllStops, haptic: 'light' },
          { icon: 'warning-outline', label: 'Reportar', onPress: onReportIncident, haptic: 'medium', color: theme.colors.warning },
          { icon: 'call-outline', label: 'Suporte', onPress: onContactSupport, haptic: 'light' },
          { icon: 'settings-outline', label: 'Navegação', onPress: onOpenSettings, haptic: 'light' },
        ];

      case 'active':
      case 'last-stop':
        return [
          { icon: 'list-outline', label: 'Todas Paradas', onPress: onViewAllStops, haptic: 'light' },
          { icon: 'warning-outline', label: 'Reportar', onPress: onReportIncident, haptic: 'medium', color: theme.colors.warning },
          { icon: 'settings-outline', label: 'Navegação', onPress: onOpenSettings, haptic: 'light' },
          { icon: 'call-outline', label: 'Suporte', onPress: onContactSupport, haptic: 'light' },
        ];

      case 'ready-to-complete':
        return [
          { icon: 'document-text-outline', label: 'Ver Resumo', onPress: onViewSummary, haptic: 'light' },
          { icon: 'list-outline', label: 'Ver Paradas', onPress: onViewAllStops, haptic: 'light' },
          { icon: 'share-outline', label: 'Compartilhar', onPress: onContactSupport, haptic: 'light' },
        ];

      case 'completed':
        return [
          { icon: 'bar-chart-outline', label: 'Detalhes', onPress: onViewSummary, haptic: 'light' },
          { icon: 'time-outline', label: 'Histórico', onPress: onViewHistory, haptic: 'light' },
          { icon: 'share-outline', label: 'Compartilhar', onPress: onContactSupport, haptic: 'light' },
        ];

      default:
        return [];
    }
  };

  const handlePress = async (action: ActionConfig) => {
    // Feedback háptico
    if (action.haptic === 'heavy') {
      await heavyHaptic();
    } else if (action.haptic === 'medium') {
      await mediumHaptic();
    } else {
      await lightHaptic();
    }

    // Executar ação
    if (action.onPress) {
      action.onPress();
    }
  };

  const actions = getActions();

  return (
    <View style={[styles.container, style]}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={styles.actionButton}
          onPress={() => handlePress(action)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[
            styles.iconContainer,
            action.color ? { backgroundColor: `${action.color}15` } : {}
          ]}>
            <Ionicons
              name={action.icon}
              size={24}
              color={action.color || theme.colors.primary}
            />
          </View>
          <Text style={[
            styles.actionLabel,
            action.color ? { color: action.color } : {}
          ]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// FAB Component
// Altura base da Tab Bar (sem safe area)
const TAB_BAR_BASE_HEIGHT = 60;

interface FloatingActionButtonProps {
  icon: IconName;
  color: string;
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  /** Margem extra acima da tab bar. Default: 16 */
  tabBarHeight?: number;
}

export function FloatingActionButton({
  icon,
  color,
  onPress,
  label,
  disabled = false,
  tabBarHeight = 16,
}: FloatingActionButtonProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  const handlePress = async () => {
    if (disabled) return;
    await heavyHaptic();
    onPress();
  };

  // FAB fica acima da tab bar (60px base + insets.bottom + margem extra)
  // Usa Math.max para garantir mínimo de 34px (Android 15 pode retornar insets.bottom = 0)
  const fabBottom = TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, 34) + tabBarHeight;

  return (
    <TouchableOpacity
      style={[
        fabStyles.fab,
        {
          backgroundColor: disabled ? theme.colors.gray400 : color,
          shadowColor: theme.colors.black,
          bottom: fabBottom,
        }
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <Ionicons name={icon} size={28} color={theme.colors.white} />
      {label && <Text style={[fabStyles.fabLabel, { color: theme.colors.white }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

// Bottom Actions Bar - Fixo no bottom da tela
interface BottomActionsBarProps {
  state: RouteStatus;
  onViewAllStops?: () => void;
  onContactSupport?: () => void;
  onReportIncident?: () => void;
  onOpenSettings?: () => void;
  onViewSummary?: () => void;
  onViewHistory?: () => void;
  bottomInset?: number;
}

export function BottomActionsBar({
  state,
  onViewAllStops,
  onContactSupport,
  onReportIncident,
  onOpenSettings,
  onViewSummary,
  onViewHistory,
  bottomInset = 0,
}: BottomActionsBarProps) {
  return (
    <View style={[bottomBarStyles.container, { paddingBottom: bottomInset + 16 }]}>
      <QuickActions
        state={state}
        onViewAllStops={onViewAllStops}
        onContactSupport={onContactSupport}
        onReportIncident={onReportIncident}
        onOpenSettings={onOpenSettings}
        onViewSummary={onViewSummary}
        onViewHistory={onViewHistory}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButton: {
    minWidth: 72,
    minHeight: 64, // Mínimo 48x48 + padding
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2'],
    paddingHorizontal: theme.spacing['2'],
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing['1'],
  },
  actionLabel: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
}));

const fabStyles = StyleSheet.create((theme: Theme) => ({
  fab: {
    position: 'absolute',
    // bottom é definido dinamicamente via prop tabBarHeight
    right: theme.spacing['5'],
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 15,
  },
  fabLabel: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing['0.5'],
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));

const bottomBarStyles = StyleSheet.create((theme: Theme) => ({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing['4'],
    paddingTop: theme.spacing['2'],
    backgroundColor: 'transparent',
  },
}));
