import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { RouteStatus } from '@/context/RouteStatusContext';
import { defaultTheme, useUnistyles } from '@/utils/styles';

interface QuickActionsProps {
  state: RouteStatus;
  onViewAllStops?: () => void;
  onContactSupport?: () => void;
  onReportIncident?: () => void;
  onOpenSettings?: () => void;
  onViewSummary?: () => void;
  style?: StyleProp<ViewStyle>;
}

const colors = defaultTheme.colors;

export function QuickActions({
  state,
  onViewAllStops,
  onContactSupport,
  onReportIncident,
  onOpenSettings,
  onViewSummary,
  style,
}: QuickActionsProps) {
  const getActions = () => {
    switch (state) {
      case 'no-route':
        return [
          { icon: 'warning-outline', label: 'Reportar', onPress: onReportIncident },
          { icon: 'help-circle-outline', label: 'Ajuda', onPress: onContactSupport },
          { icon: 'bar-chart-outline', label: 'Estatisticas', onPress: onViewSummary },
        ];

      case 'pending':
        return [
          { icon: 'list-outline', label: 'Ver Paradas', onPress: onViewAllStops },
          { icon: 'warning-outline', label: 'Reportar', onPress: onReportIncident },
          { icon: 'call-outline', label: 'Suporte', onPress: onContactSupport },
        ];

      case 'active':
      case 'last-stop':
        return [
          { icon: 'list-outline', label: 'Todas Paradas', onPress: onViewAllStops },
          { icon: 'warning-outline', label: 'Reportar', onPress: onReportIncident },
          { icon: 'settings-outline', label: 'Navegacao', onPress: onOpenSettings },
        ];

      case 'ready-to-complete':
        return [
          { icon: 'checkmark-circle-outline', label: 'Ver Resumo', onPress: onViewSummary },
          { icon: 'share-outline', label: 'Compartilhar', onPress: onContactSupport },
        ];

      case 'completed':
        return [
          { icon: 'bar-chart-outline', label: 'Ver Detalhes', onPress: onViewSummary },
          { icon: 'share-outline', label: 'Compartilhar', onPress: onContactSupport },
        ];

      default:
        return [];
    }
  };

  const actions = getActions();

  return (
    <View style={[styles.container, style]}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={styles.actionButton}
          onPress={() => {
            if (action.onPress) {
              action.onPress();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name={action.icon as any} size={22} color={colors.primary} />
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// FAB Component
interface FloatingActionButtonProps {
  icon: string;
  color: string;
  onPress: () => void;
  label?: string;
}

export function FloatingActionButton({
  icon,
  color,
  onPress,
  label,
}: FloatingActionButtonProps) {
  const { theme } = useUnistyles();

  return (
    <TouchableOpacity
      style={[fabStyles.fab, { backgroundColor: color, shadowColor: theme.colors.black }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon as any} size={28} color={theme.colors.white} />
      {label && <Text style={[fabStyles.fabLabel, { color: theme.colors.white }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    marginVertical: 6,
  },
  actionLabel: {
    fontSize: 12,
    color: colors.gray700,
    marginTop: 4,
    textAlign: 'center',
  },
});

const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 120,
    right: 24,
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
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
});
