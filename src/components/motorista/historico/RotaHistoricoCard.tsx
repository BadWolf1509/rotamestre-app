/**
 * RotaHistoricoCard - Expandable card for a single route in history
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '@/design-system';
import { calcularTempoTotal, type RotaHistorico } from '@/hooks/motorista/historico';
import { parseLocalDate } from '@/lib/dateUtils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface RotaHistoricoCardProps {
  item: RotaHistorico;
  isExpanded: boolean;
  onToggle: () => void;
}

export const RotaHistoricoCard = React.memo(function RotaHistoricoCard({
  item,
  isExpanded,
  onToggle,
}: RotaHistoricoCardProps) {
  const { theme } = useUnistyles();

  const isPendente = item.status === 'pendente';
  const isEmAndamento = item.status === 'em_andamento';
  const isConcluida = item.status === 'concluida';
  const isCancelada = item.status === 'cancelada';
  const isNaoExecutada = item.status === 'nao_executada';

  const taxaConclusao =
    item.paradas_count && item.paradas_count > 0
      ? Math.round((item.paradas_concluidas! / item.paradas_count) * 100)
      : 0;

  const paradasPendentes = (item.paradas_count || 0) - (item.paradas_concluidas || 0);
  const tempoTotal = calcularTempoTotal(item);

  const statusLabel = isPendente
    ? 'pendente'
    : isEmAndamento
      ? 'em andamento'
      : isConcluida
        ? 'concluída'
        : isNaoExecutada
          ? 'não executada'
          : 'cancelada';

  return (
    <TouchableOpacity
      style={[
        styles.rotaCard,
        isPendente && styles.rotaCardPendente,
        isEmAndamento && styles.rotaCardEmAndamento,
        isConcluida && styles.rotaCardConcluida,
        isCancelada && styles.rotaCardCancelada,
        isNaoExecutada && styles.rotaCardNaoExecutada,
      ]}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityLabel={`Rota ${statusLabel} de ${item.unidades.nome}, ${item.paradas_count || 0} paradas`}
      accessibilityRole="button"
      accessibilityHint={isExpanded ? 'Toque para recolher detalhes' : 'Toque para ver mais detalhes'}
    >
      {/* Header */}
      <View style={styles.rotaHeader}>
        <View style={styles.rotaHeaderLeft}>
          <Text style={styles.rotaData}>
            {parseLocalDate(item.data)?.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }) || item.data}
          </Text>
          <Text style={styles.rotaUnidade}>{item.unidades.nome}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            isPendente && styles.statusBadgePendente,
            isEmAndamento && styles.statusBadgeEmAndamento,
            isConcluida && styles.statusBadgeConcluida,
            isCancelada && styles.statusBadgeCancelada,
            isNaoExecutada && styles.statusBadgeNaoExecutada,
          ]}
        >
          <Text style={[
            styles.statusBadgeText,
            isNaoExecutada && styles.statusBadgeTextNaoExecutada,
          ]}>
            {isPendente && 'Pendente'}
            {isEmAndamento && 'Em Andamento'}
            {isConcluida && 'Concluída'}
            {isCancelada && 'Cancelada'}
            {isNaoExecutada && '⚠️ Não Executada'}
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.rotaStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.paradas_count || 0}</Text>
          <Text style={styles.statLabel}>Paradas</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            {item.paradas_concluidas || 0}
          </Text>
          <Text style={styles.statLabel}>Concluídas</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.purple600 }]}>
            {taxaConclusao}%
          </Text>
          <Text style={styles.statLabel}>Taxa</Text>
        </View>
      </View>

      {/* Expanded Details */}
      {isExpanded && (
        <View style={styles.rotaDetalhes}>
          <View style={styles.divider} />

          {isNaoExecutada && paradasPendentes > 0 && (
            <View style={styles.naoExecutadaInfo}>
              <Ionicons name="warning" size={16} color={theme.colors.warning} />
              <Text style={styles.naoExecutadaInfoText}>
                {paradasPendentes} {paradasPendentes === 1 ? 'parada ficou pendente' : 'paradas ficaram pendentes'}
              </Text>
            </View>
          )}

          {item.iniciada_em && (
            <View style={styles.detalheRow}>
              <Text style={styles.detalheLabel}>Início:</Text>
              <Text style={styles.detalheValue}>
                {new Date(item.iniciada_em).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}

          {item.concluida_em && (
            <View style={styles.detalheRow}>
              <Text style={styles.detalheLabel}>Conclusão:</Text>
              <Text style={styles.detalheValue}>
                {new Date(item.concluida_em).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}

          {tempoTotal && (
            <View style={styles.detalheRow}>
              <Text style={styles.detalheLabel}>Tempo Total:</Text>
              <Text style={styles.detalheValue}>{tempoTotal}</Text>
            </View>
          )}

          {item.distancia_total && (
            <View style={styles.detalheRow}>
              <Text style={styles.detalheLabel}>Distância:</Text>
              <Text style={styles.detalheValue}>
                {item.distancia_total.toFixed(1)} km
              </Text>
            </View>
          )}

          {item.paradas_count && item.paradas_count > 0 && (
            <View style={styles.detalheRow}>
              <Text style={styles.detalheLabel}>Progresso:</Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${taxaConclusao}%` },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {/* Expand Indicator */}
      <View style={styles.expandIndicator}>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.primary}
        />
        <Text style={styles.expandIndicatorText}>
          {isExpanded ? 'Menos detalhes' : 'Mais detalhes'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  rotaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.gray300,
    ...theme.shadows.sm,
  },
  rotaCardPendente: {
    borderLeftColor: theme.colors.warning,
  },
  rotaCardEmAndamento: {
    borderLeftColor: theme.colors.blue500,
  },
  rotaCardConcluida: {
    borderLeftColor: theme.colors.success,
  },
  rotaCardCancelada: {
    borderLeftColor: theme.colors.error,
    opacity: 0.7,
  },
  rotaCardNaoExecutada: {
    borderLeftColor: theme.colors.warning,
    backgroundColor: theme.colors.warningBg,
  },
  rotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  rotaHeaderLeft: {
    flex: 1,
  },
  rotaData: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  rotaUnidade: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  statusBadgePendente: {
    backgroundColor: theme.colors.yellow100,
  },
  statusBadgeEmAndamento: {
    backgroundColor: theme.colors.blue100,
  },
  statusBadgeConcluida: {
    backgroundColor: theme.colors.green100,
  },
  statusBadgeCancelada: {
    backgroundColor: theme.colors.red100,
  },
  statusBadgeNaoExecutada: {
    backgroundColor: theme.colors.yellow100,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  statusBadgeText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  statusBadgeTextNaoExecutada: {
    color: theme.colors.warning,
  },
  rotaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing.xs,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  rotaDetalhes: {
    marginTop: theme.spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.gray300,
    marginVertical: theme.spacing.md,
  },
  detalheRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  detalheLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  detalheValue: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: theme.borderRadius.sm,
  },
  expandIndicator: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  expandIndicatorText: {
    fontSize: theme.typography.xs,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  naoExecutadaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.yellow100,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  naoExecutadaInfoText: {
    fontSize: theme.typography.sm,
    color: theme.colors.warning,
    fontFamily: theme.typography.fontSansSemiBold,
    flex: 1,
  },
}));
