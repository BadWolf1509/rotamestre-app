/**
 * LastRouteCard - Card de resumo da última rota concluída do dia
 *
 * Exibe quando o motorista concluiu pelo menos uma rota hoje
 * e está no estado "no-route"
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface LastRouteData {
  /** Horário de conclusão (formato HH:MM) */
  concluida_em: string;
  /** Número de paradas concluídas */
  paradas_concluidas: number;
  /** Número total de paradas */
  total_paradas: number;
  /** Distância total em km */
  distancia_km: number;
  /** Tempo total formatado (ex: "2h 28min") */
  tempo_total: string;
}

interface LastRouteCardProps {
  data: LastRouteData;
}

/**
 * Formata horário de ISO string para HH:MM
 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
}

export function LastRouteCard({ data }: LastRouteCardProps) {
  const { theme } = useUnistyles();

  const horario = formatTime(data.concluida_em);
  const taxaSucesso = data.total_paradas > 0
    ? Math.round((data.paradas_concluidas / data.total_paradas) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={theme.colors.success}
          />
          <Text style={styles.headerText}>Última rota</Text>
        </View>
        <Text style={styles.timeText}>Concluída às {horario}</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {/* Paradas */}
        <View style={styles.stat}>
          <Ionicons
            name="location"
            size={14}
            color={theme.colors.gray500}
          />
          <Text style={styles.statValue}>
            {data.paradas_concluidas}/{data.total_paradas}
          </Text>
          <Text style={styles.statLabel}>paradas</Text>
        </View>

        {/* Distância */}
        <View style={styles.stat}>
          <Ionicons
            name="speedometer-outline"
            size={14}
            color={theme.colors.gray500}
          />
          <Text style={styles.statValue}>
            {data.distancia_km > 0 ? `${data.distancia_km}` : '--'}
          </Text>
          <Text style={styles.statLabel}>km</Text>
        </View>

        {/* Tempo */}
        <View style={styles.stat}>
          <Ionicons
            name="time-outline"
            size={14}
            color={theme.colors.gray500}
          />
          <Text style={styles.statValue}>{data.tempo_total || '--'}</Text>
          <Text style={styles.statLabel}>tempo</Text>
        </View>

        {/* Taxa de sucesso */}
        <View style={styles.stat}>
          <Ionicons
            name="trending-up"
            size={14}
            color={taxaSucesso >= 80 ? theme.colors.success : theme.colors.warning}
          />
          <Text style={[
            styles.statValue,
            { color: taxaSucesso >= 80 ? theme.colors.success : theme.colors.warning }
          ]}>
            {taxaSucesso}%
          </Text>
          <Text style={styles.statLabel}>sucesso</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.successBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.gray700,
  },
  timeText: {
    fontSize: 12,
    color: theme.colors.gray500,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.gray800,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.gray500,
  },
}));
