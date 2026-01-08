/**
 * ExpiredRouteCard - Card de aviso de rota expirada
 *
 * Exibe quando a última rota do motorista expirou (status = nao_executada)
 * nas últimas 24 horas, dando visibilidade ao motorista sobre o que aconteceu.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { formatDateRelative } from '@/lib/dateUtils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface ExpiredRouteData {
  /** ID da rota expirada */
  rota_id: string;
  /** Data da rota (formato YYYY-MM-DD) */
  data: string;
  /** Número de paradas que ficaram pendentes */
  paradas_pendentes: number;
  /** Número total de paradas */
  total_paradas: number;
  /** Número de paradas concluídas */
  paradas_concluidas: number;
}

interface ExpiredRouteCardProps {
  data: ExpiredRouteData;
  /** Callback para dispensar o card */
  onDismiss?: () => void;
}

export function ExpiredRouteCard({ data, onDismiss }: ExpiredRouteCardProps) {
  const { theme } = useUnistyles();
  const router = useRouter();

  const dataFormatada = formatDateRelative(data.data);
  const hasCompletedSome = data.paradas_concluidas > 0;

  const handleViewHistory = () => {
    router.push('/motorista/historico');
  };

  return (
    <View style={styles.container}>
      {/* Header com ícone e botão de fechar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="alert-circle"
            size={20}
            color={theme.colors.warning}
          />
          <Text style={styles.headerText}>Rota expirada</Text>
        </View>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Dispensar aviso"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={20} color={theme.colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {/* Conteúdo principal */}
      <Text style={styles.message}>
        Sua rota de {dataFormatada} não foi concluída e expirou às 22h.
      </Text>

      {/* Estatísticas */}
      <View style={styles.statsRow}>
        {hasCompletedSome ? (
          <>
            <View style={styles.stat}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={theme.colors.success}
              />
              <Text style={[styles.statText, { color: theme.colors.success }]}>
                {data.paradas_concluidas} concluída{data.paradas_concluidas !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.statDivider} />
          </>
        ) : null}
        <View style={styles.stat}>
          <Ionicons
            name="close-circle"
            size={14}
            color={theme.colors.error}
          />
          <Text style={[styles.statText, { color: theme.colors.error }]}>
            {data.paradas_pendentes} pendente{data.paradas_pendentes !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Link para histórico */}
      <TouchableOpacity
        style={styles.linkButton}
        onPress={handleViewHistory}
        accessibilityLabel="Ver detalhes no histórico"
        accessibilityRole="link"
      >
        <Text style={styles.linkText}>Ver no histórico</Text>
        <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing['3'],
    marginBottom: theme.spacing['2'],
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing['2'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
  },
  headerText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.warning,
  },
  message: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.gray700,
    lineHeight: 18,
    marginBottom: theme.spacing['2.5'],
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing['2.5'],
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  statText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: theme.colors.gray300,
    marginHorizontal: theme.spacing['2.5'],
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing['1'],
    paddingVertical: theme.spacing['2'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.warning,
  },
  linkText: {
    fontSize: theme.typography.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
