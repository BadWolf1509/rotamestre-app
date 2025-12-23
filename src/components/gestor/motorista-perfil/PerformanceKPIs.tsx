/**
 * PerformanceKPIs - Grid de métricas de performance do motorista
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

import type { MotoristaPerformance } from './types';

interface PerformanceKPIsProps {
  performance: MotoristaPerformance;
}

interface KPICardProps {
  value: string | number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  valueStyle?: 'success' | 'warning' | 'error' | 'default';
}

function KPICard({ value, label, icon, color, valueStyle = 'default' }: KPICardProps) {
  const { theme: _theme } = useUnistyles();

  const getValueStyle = () => {
    switch (valueStyle) {
      case 'success':
        return styles.kpiValueSuccess;
      case 'warning':
        return styles.kpiValueWarning;
      case 'error':
        return styles.kpiValueError;
      default:
        return {};
    }
  };

  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiHeader}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <View style={[styles.kpiIconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
      </View>
      <Text style={[styles.kpiValue, getValueStyle()]}>{value}</Text>
    </View>
  );
}

export function PerformanceKPIs({ performance }: PerformanceKPIsProps) {
  const { theme } = useUnistyles();

  const formatTempo = (minutos: number | null) => {
    if (!minutos) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    if (horas === 0) return `${mins}min`;
    return `${horas}h ${mins}m`;
  };

  const formatDistancia = (km: number | null) => {
    if (!km) return '-';
    return `${km.toFixed(1)} km`;
  };

  const taxaStyle = useMemo(() => {
    if (performance.taxa_execucao >= 80) return 'success';
    if (performance.taxa_execucao >= 50) return 'warning';
    return 'error';
  }, [performance.taxa_execucao]);

  const naoExecStyle = useMemo(() => {
    if (performance.rotas_nao_executadas === 0) return 'default';
    if (performance.rotas_nao_executadas <= 2) return 'warning';
    return 'error';
  }, [performance.rotas_nao_executadas]);

  return (
    <View style={styles.kpisContainer}>
      <View style={styles.kpisGrid}>
        <KPICard
          value={performance.total_rotas}
          label="Total de Rotas"
          icon="navigate"
          color={theme.colors.primary}
        />

        <KPICard
          value={performance.rotas_concluidas}
          label="Concluídas"
          icon="checkmark-circle"
          color={theme.colors.success}
          valueStyle="success"
        />

        <KPICard
          value={`${performance.taxa_execucao}%`}
          label="Taxa de Execução"
          icon="trending-up"
          color={taxaStyle === 'success' ? theme.colors.success : taxaStyle === 'warning' ? theme.colors.warning : theme.colors.error}
          valueStyle={taxaStyle}
        />

        <KPICard
          value={performance.rotas_nao_executadas}
          label="Não Executadas"
          icon="alert-circle"
          color={naoExecStyle === 'default' ? theme.colors.gray500 : theme.colors.warning}
          valueStyle={naoExecStyle}
        />

        <KPICard
          value={performance.rotas_em_andamento}
          label="Em Andamento"
          icon="time"
          color={theme.colors.info}
        />

        <KPICard
          value={formatDistancia(performance.distancia_total_km)}
          label="Distância Total"
          icon="speedometer"
          color={theme.colors.secondary}
        />

        <KPICard
          value={formatTempo(performance.tempo_medio_minutos)}
          label="Tempo Médio"
          icon="hourglass"
          color={theme.colors.primaryDark}
        />

        <KPICard
          value={performance.rotas_canceladas}
          label="Canceladas"
          icon="close-circle"
          color={theme.colors.gray500}
        />
      </View>
    </View>
  );
}
