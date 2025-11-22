import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
  const isPendente = status === 'pendente';
  const isEmAndamento = status === 'em_andamento';
  const _isConcluida = status === 'concluida';
  const _isCancelada = status === 'cancelada';

  const actions = [
    {
      id: 'editar',
      label: 'Editar Rota',
      icon: 'create-outline' as const,
      color: '#3b82f6',
      onPress: onEditar,
      show: isPendente,
    },
    {
      id: 'add-parada',
      label: 'Adicionar Parada',
      icon: 'add-circle-outline' as const,
      color: '#10b981',
      onPress: onAddParada,
      show: isPendente || isEmAndamento,
    },
    {
      id: 'reatribuir',
      label: 'Reatribuir Motorista',
      icon: 'person-outline' as const,
      color: '#f59e0b',
      onPress: onReatribuir,
      show: isPendente || isEmAndamento,
    },
    {
      id: 'cancelar',
      label: 'Cancelar Rota',
      icon: 'close-circle-outline' as const,
      color: '#ef4444',
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
        <Ionicons name="settings-outline" size={20} color="#64748b" />
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
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
        <Text style={styles.statusText}>{getStatusLabel(status)}</Text>
      </View>
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pendente':
      return '#f59e0b';
    case 'em_andamento':
      return '#3b82f6';
    case 'concluida':
      return '#22c55e';
    case 'cancelada':
      return '#ef4444';
    default:
      return '#64748b';
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#475569',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
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
    color: '#334155',
    textAlign: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
});
