import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from '@/utils/styles';
import { RouteStatus } from '@/context/RouteStatusContext';

interface QuickActionsProps {
  state: RouteStatus;
  onViewAllStops?: () => void;
  onViewHistory?: () => void;
  onContactSupport?: () => void;
  onReportIncident?: () => void;
  onOpenSettings?: () => void;
}

export function QuickActions({
  state,
  onViewAllStops,
  onViewHistory,
  onContactSupport,
  onReportIncident,
  onOpenSettings,
}: QuickActionsProps) {
  const { theme } = useUnistyles();

  const getActions = () => {
    switch (state) {
      case 'no-route':
        return [
          { icon: 'time-outline', label: 'Histórico', onPress: onViewHistory },
          { icon: 'help-circle-outline', label: 'Ajuda', onPress: onContactSupport },
        ];

      case 'pending':
        return [
          { icon: 'list-outline', label: 'Ver Paradas', onPress: onViewAllStops },
          { icon: 'time-outline', label: 'Histórico', onPress: onViewHistory },
        ];

      case 'active':
      case 'last-stop':
        return [
          { icon: 'list-outline', label: 'Todas Paradas', onPress: onViewAllStops },
          { icon: 'warning-outline', label: 'Reportar', onPress: onReportIncident },
          { icon: 'settings-outline', label: 'Navegação', onPress: onOpenSettings },
        ];

      case 'ready-to-complete':
        return [
          { icon: 'list-outline', label: 'Ver Resumo', onPress: onViewAllStops },
          { icon: 'time-outline', label: 'Histórico', onPress: onViewHistory },
        ];

      case 'completed':
        return [
          { icon: 'time-outline', label: 'Histórico', onPress: onViewHistory },
          { icon: 'refresh-outline', label: 'Nova Rota', onPress: () => {} },
        ];

      default:
        return [];
    }
  };

  const actions = getActions();

  return (
    <View style={styles.container}>
      {actions.map((action, index) => (
        <TouchableOpacity
          key={index}
          style={styles.actionButton}
          onPress={action.onPress}
        >
          <Ionicons
            name={action.icon as any}
            size={24}
            color={theme.colors.primary}
          />
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  actionButton: {
    alignItems: 'center',
    padding: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: '#374151',
    marginTop: 4,
  },
});

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
  return (
    <TouchableOpacity
      style={[fabStyles.fab, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon as any} size={28} color="#fff" />
      {label && <Text style={fabStyles.fabLabel}>{label}</Text>}
    </TouchableOpacity>
  );
}

const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabLabel: {
    color: '#fff',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
});