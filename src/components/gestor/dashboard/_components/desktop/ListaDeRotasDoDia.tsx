/**
 * ListaDeRotasDoDia — uma linha por rota na Início desktop: motorista, linha
 * de paradas, "3 de 8", status e distância.
 *
 * A linha inteira é clicável e abre o mapa da rota. "Excluir rota" fica no
 * menu "⋯" (`MenuDeAcoes`), que interrompe a propagação: escolher nele não
 * abre a rota junto. A confirmação continua no `Dialog` do `DashboardDesktop`.
 */

import React, { useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { MenuDeAcoes } from '@/components/data-table/MenuDeAcoes';
import type { DataTableAction } from '@/components/data-table/types';
import { rotuloDoStatus } from '@/constants/statusConfig';
import { StatusCell } from '@/design-system';
import { formatarDecimal } from '@/lib/formatNumber';
import { StyleSheet, type Theme } from '@/utils/styles';

import { LinhaDeParadas } from './LinhaDeParadas';

import type { RotaResumo } from '../../_hooks/useDashboardData';

interface ListaDeRotasDoDiaProps {
  rotas: RotaResumo[];
  onAbrirRota: (rotaId: string) => void;
  onExcluirRota: (rotaId: string) => void;
}

function rotuloDaLinha(rota: RotaResumo): string {
  return [
    rota.motorista_nome,
    `${rota.paradas_concluidas} de ${rota.total_paradas} paradas feitas`,
    rotuloDoStatus(rota.status),
    `${formatarDecimal(rota.distancia_total)} km`,
  ].join(', ');
}

export function ListaDeRotasDoDia({
  rotas,
  onAbrirRota,
  onExcluirRota,
}: ListaDeRotasDoDiaProps) {
  const acoes = useMemo<DataTableAction<RotaResumo>[]>(
    () => [
      {
        label: 'Excluir rota',
        icon: 'trash-outline',
        type: 'danger',
        onPress: (rota) => onExcluirRota(rota.id),
      },
    ],
    [onExcluirRota],
  );

  return (
    <View style={styles.cartao} testID="rotas-table">
      {rotas.map((rota, indice) => (
        <Pressable
          key={rota.id}
          testID={`rota-dia-${rota.id}`}
          onPress={() => onAbrirRota(rota.id)}
          accessibilityRole="button"
          accessibilityLabel={rotuloDaLinha(rota)}
          accessibilityHint="Abre o detalhe"
          style={[styles.linha, indice > 0 && styles.linhaComDivisor]}
        >
          <Text style={styles.nome} numberOfLines={1} ellipsizeMode="tail">
            {rota.motorista_nome}
          </Text>
          <View style={styles.paradas}>
            <LinhaDeParadas paradas={rota.paradas_status ?? []} />
          </View>
          <Text style={styles.contagem} numberOfLines={1}>
            {`${rota.paradas_concluidas} de ${rota.total_paradas}`}
          </Text>
          <View style={styles.status}>
            <StatusCell
              status={rota.status}
              label={rotuloDoStatus(rota.status)}
            />
          </View>
          <Text style={styles.distancia} numberOfLines={1}>
            {`${formatarDecimal(rota.distancia_total)} km`}
          </Text>
          <MenuDeAcoes
            item={rota}
            acoes={acoes}
            testID={`rota-dia-acoes-${rota.id}`}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  cartao: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    overflow: 'hidden',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...(Platform.OS === 'web' &&
      ({
        cursor: 'pointer',
        ':hover': { backgroundColor: theme.colors.gray50 },
      } as any)),
  },
  linhaComDivisor: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  // Colunas fixas enxutas (nome 170, contagem 64, status 120, distância 64):
  // a linha de paradas é a que cresce. Status 120 = "Em andamento" a 13 px
  // semibold (89 px) + ícone 13 + gap 4 + padding 8 + borda 2 = 116.
  nome: {
    width: 170,
    flexShrink: 0,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  paradas: {
    flex: 1,
    minWidth: 0,
  },
  contagem: {
    width: 64,
    flexShrink: 0,
    textAlign: 'right',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  status: {
    width: 120,
    flexShrink: 0,
  },
  distancia: {
    width: 64,
    flexShrink: 0,
    textAlign: 'right',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
}));
