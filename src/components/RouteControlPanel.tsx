import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface RouteControlPanelProps {
  rotaId: string;
  status: string;
  onReatribuir?: () => void;
  onCancelar?: () => void;
  onAddParada?: () => void;
  onEditar?: () => void;
}

export function RouteControlPanel({
  rotaId: _rotaId,
  status,
  onReatribuir,
  onCancelar,
  onAddParada,
  onEditar,
}: RouteControlPanelProps) {
  const { theme } = useUnistyles();
  const isPendente = status === 'pendente';
  const isEmAndamento = status === 'em_andamento';
  const _isConcluida = status === 'concluida';
  const _isCancelada = status === 'cancelada';

  const actions = [
    {
      id: 'editar',
      label: 'Editar Rota',
      icon: 'create-outline' as const,
      color: theme.colors.info,
      onPress: onEditar,
      show: isPendente,
    },
    {
      id: 'add-parada',
      label: 'Adicionar Parada',
      icon: 'add-circle-outline' as const,
      color: theme.colors.success,
      onPress: onAddParada,
      show: isPendente || isEmAndamento,
    },
    {
      id: 'reatribuir',
      label: 'Reatribuir Motorista',
      icon: 'person-outline' as const,
      color: theme.colors.warning,
      onPress: onReatribuir,
      show: isPendente || isEmAndamento,
    },
    {
      id: 'cancelar',
      label: 'Cancelar Rota',
      icon: 'close-circle-outline' as const,
      color: theme.colors.error,
      onPress: onCancelar,
      show: isPendente || isEmAndamento,
    },
  ];

  const visibleActions = actions.filter((action) => action.show);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="settings-outline" size={20} color={theme.colors.gray500} />
        <Text style={styles.headerTitle}>Ações Rápidas</Text>
      </View>

      <View style={styles.actionsGrid}>
        {visibleActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.actionButton, { borderColor: action.color }]}
            onPress={action.onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${action.color}15` }]}>
              <Ionicons name={action.icon} size={24} color={action.color} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status info */}
      <View style={styles.statusInfo}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(status, theme) }]} />
        <Text style={styles.statusText}>{getStatusLabel(status)}</Text>
      </View>
    </View>
  );
}

function getStatusColor(status: string, theme: Theme): string {
  switch (status) {
    case 'pendente':
      return theme.colors.warning;
    case 'em_andamento':
      return theme.colors.info;
    case 'concluida':
      return theme.colors.success;
    case 'cancelada':
      return theme.colors.error;
    default:
      return theme.colors.gray500;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pendente':
      return 'Aguardando início';
    case 'em_andamento':
      return 'Em andamento';
    case 'concluida':
      return 'Concluída';
    case 'cancelada':
      return 'Cancelada';
    default:
      return status;
  }
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.gray50,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray600,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    minWidth: 140,
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 13,
    color: theme.colors.gray500,
    fontWeight: '500',
  },
}));
