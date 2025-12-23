/**
 * RotasRecentes - Lista das últimas rotas do motorista
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

import type { RotaRecente } from './types';

interface RotasRecentesProps {
  rotas: RotaRecente[];
  onVerTodas?: () => void;
}

const STATUS_CONFIG = {
  concluida: {
    label: 'Concluída',
    badgeStyle: 'rotaStatusConcluida',
    textStyle: 'rotaStatusTextConcluida',
    icon: 'checkmark-circle',
    iconColor: 'success',
  },
  em_andamento: {
    label: 'Em andamento',
    badgeStyle: 'rotaStatusEmAndamento',
    textStyle: 'rotaStatusTextEmAndamento',
    icon: 'time',
    iconColor: 'info',
  },
  pendente: {
    label: 'Pendente',
    badgeStyle: 'rotaStatusPendente',
    textStyle: 'rotaStatusTextPendente',
    icon: 'hourglass',
    iconColor: 'warning',
  },
  nao_executada: {
    label: 'Não executada',
    badgeStyle: 'rotaStatusNaoExecutada',
    textStyle: 'rotaStatusTextNaoExecutada',
    icon: 'alert-circle',
    iconColor: 'error',
  },
  cancelada: {
    label: 'Cancelada',
    badgeStyle: 'rotaStatusCancelada',
    textStyle: 'rotaStatusTextCancelada',
    icon: 'close-circle',
    iconColor: 'gray600',
  },
} as const;

function RotaCard({ rota }: { rota: RotaRecente }) {
  const { theme } = useUnistyles();
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const statusConfig = STATUS_CONFIG[rota.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pendente;
  const iconColor = theme.colors[statusConfig.iconColor as keyof typeof theme.colors] || theme.colors.gray500;

  return (
    <TouchableOpacity
      style={styles.rotaCard}
      onPress={() => router.push(`/gestor/mapa-rota?id=${rota.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rotaCardLeft}>
        <View style={[styles.rotaIconContainer, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={statusConfig.icon as any} size={20} color={iconColor} />
        </View>
        <View style={styles.rotaInfo}>
          <Text style={styles.rotaData}>{formatDate(rota.data)}</Text>
          {rota.distancia_total && (
            <Text style={styles.rotaDistancia}>{rota.distancia_total.toFixed(1)} km</Text>
          )}
        </View>
      </View>

      <View style={[styles.rotaStatusBadge, styles[statusConfig.badgeStyle as keyof typeof styles]]}>
        <Text style={[styles.rotaStatusText, styles[statusConfig.textStyle as keyof typeof styles]]}>
          {statusConfig.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function RotasRecentes({ rotas, onVerTodas }: RotasRecentesProps) {
  const { theme } = useUnistyles();

  if (rotas.length === 0) {
    return (
      <View style={styles.rotasContainer}>
        <Text style={styles.rotasTitle}>Rotas Recentes</Text>
        <View style={styles.emptyRotas}>
          <Ionicons name="navigate-outline" size={40} color={theme.colors.gray300} />
          <Text style={styles.emptyRotasText}>
            Nenhuma rota encontrada para este motorista
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rotasContainer}>
      <View style={styles.rotasHeader}>
        <Text style={styles.rotasTitle}>Rotas Recentes</Text>
        {onVerTodas && (
          <TouchableOpacity onPress={onVerTodas}>
            <Text style={styles.rotasVerTodas}>Ver todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {rotas.map((rota) => (
        <RotaCard key={rota.id} rota={rota} />
      ))}
    </View>
  );
}
