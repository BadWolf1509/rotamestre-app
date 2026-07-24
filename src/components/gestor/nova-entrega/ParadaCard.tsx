/**
 * Componente para exibição de um card de parada individual
 * Suporta densidade compacta para desktop
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { Parada } from './types';

export interface ParadaCardProps {
  parada: Parada;
  index: number;
  totalParadas: number;
  retiradaVinculada: Parada | null;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
  onEdit: (index: number) => void;
  onDrag?: () => void;
  isDragging?: boolean;
}

export const ParadaCard = memo(function ParadaCard({
  parada,
  index,
  totalParadas,
  retiradaVinculada,
  onMoveUp,
  onMoveDown,
  onRemove,
  onEdit,
  onDrag,
  isDragging = false,
}: ParadaCardProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const styles = createStyles(theme, isDesktop);

  const isFirst = index === 0;
  const isLast = index === totalParadas - 1;

  return (
    <View
      style={[
        styles.paradaCard,
        parada.vinculo_parada_id && styles.paradaCardVinculada,
        isDragging && styles.paradaCardDragging,
      ]}
    >
      <View style={styles.paradaCardContent}>
        {totalParadas > 1 && (
          <View style={styles.reorderButtons}>
            {onDrag && (
              <TouchableOpacity
                style={styles.dragHandle}
                onLongPress={onDrag}
                delayLongPress={180}
                accessibilityLabel={`Arrastar parada ${parada.ordem}`}
                accessibilityHint="Mantenha pressionado e arraste para mudar a posição"
                accessibilityRole="button"
              >
                <Ionicons
                  name="reorder-three"
                  size={isDesktop ? 18 : 22}
                  color={theme.colors.gray500}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.reorderButton,
                isFirst && styles.reorderButtonDisabled,
              ]}
              onPress={() => onMoveUp(index)}
              disabled={isFirst}
              accessibilityLabel={`Mover parada ${parada.ordem} para cima`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isFirst }}
            >
              <Ionicons
                name="chevron-up"
                size={isDesktop ? 16 : 20}
                color={isFirst ? theme.colors.gray300 : theme.colors.gray600}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.reorderButton,
                isLast && styles.reorderButtonDisabled,
              ]}
              onPress={() => onMoveDown(index)}
              disabled={isLast}
              accessibilityLabel={`Mover parada ${parada.ordem} para baixo`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isLast }}
            >
              <Ionicons
                name="chevron-down"
                size={isDesktop ? 16 : 20}
                color={isLast ? theme.colors.gray300 : theme.colors.gray600}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.paradaInfo}>
          <View style={styles.paradaHeader}>
            <Text style={styles.paradaTipo}>
              {`${parada.ordem}. ${parada.tipo.toUpperCase()}`}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() => onEdit(index)}
                accessibilityLabel={`Editar parada ${parada.ordem}`}
                accessibilityRole="button"
              >
                <Text style={styles.editButton}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onRemove(index)}
                accessibilityLabel={`Remover parada ${parada.ordem}`}
                accessibilityRole="button"
              >
                <Text style={styles.removeButton}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.paradaEndereco}>{parada.endereco}</Text>
          {parada.destinatario && (
            <Text style={styles.paradaDetail}>
              Destinatário: {parada.destinatario}
            </Text>
          )}
          <Text style={styles.paradaDetail}>Telefone: {parada.telefone}</Text>
          {parada.observacoes && (
            <Text style={styles.paradaObservacoes}>
              Observações: {parada.observacoes}
            </Text>
          )}
          {retiradaVinculada && (
            <View style={styles.vinculoBadge}>
              <Text style={styles.vinculoBadgeText}>
                Depende de: Retirada em{' '}
                {retiradaVinculada.destinatario ||
                  retiradaVinculada.endereco.substring(0, 25)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

const createStyles = (theme: Theme, isDesktop: boolean) =>
  StyleSheet.create({
    paradaCard: {
      backgroundColor: theme.colors.white,
      padding: isDesktop ? theme.desktop.section.padding : theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      marginBottom: isDesktop ? theme.spacing.sm : theme.spacing.md,
      borderLeftWidth: isDesktop ? 3 : 4,
      borderLeftColor: theme.colors.primaryDark,
      borderWidth: 1,
      borderColor: theme.colors.gray200,
    },
    paradaCardVinculada: {
      borderLeftColor: theme.colors.info,
      backgroundColor: theme.colors.info + '08',
    },
    paradaCardDragging: {
      opacity: 0.9,
      borderColor: theme.colors.primary,
      ...theme.shadows.md,
    },
    paradaCardContent: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: isDesktop ? theme.spacing.sm : theme.spacing.md,
    },
    reorderButtons: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: isDesktop ? 2 : theme.spacing.xs,
      paddingRight: isDesktop ? 6 : theme.spacing.sm,
      borderRightWidth: 1,
      borderRightColor: theme.colors.gray200,
    },
    dragHandle: {
      width: isDesktop ? 28 : 36,
      height: isDesktop ? 28 : 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Desktop: 28x28, Mobile: 36x36 (WCAG 2.2 - mouse permite touch target menor)
    reorderButton: {
      width: isDesktop ? 28 : 36,
      height: isDesktop ? 28 : 36,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.gray100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reorderButtonDisabled: {
      backgroundColor: theme.colors.gray50,
      opacity: 0.5,
    },
    paradaInfo: {
      flex: 1,
    },
    paradaHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isDesktop ? theme.spacing.sm : theme.spacing.md,
    },
    paradaTipo: {
      fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.primaryDark,
    },
    removeButton: {
      color: theme.colors.error,
      fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      // Desktop: aumentar touch target com padding
      paddingVertical: isDesktop ? 4 : 0,
      paddingHorizontal: isDesktop ? 6 : 0,
    },
    editButton: {
      color: theme.colors.primary,
      fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      paddingVertical: isDesktop ? 4 : 0,
      paddingHorizontal: isDesktop ? 6 : 0,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    paradaEndereco: {
      fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.sm,
      color: theme.colors.gray900,
      marginBottom: isDesktop ? 4 : theme.spacing.sm,
      lineHeight: isDesktop ? 18 : 20,
    },
    paradaDetail: {
      fontSize: isDesktop ? 12 : theme.typography.xs,
      color: theme.colors.gray500,
    },
    paradaObservacoes: {
      fontSize: isDesktop ? 12 : theme.typography.xs,
      color: theme.colors.gray600,
      marginTop: 2,
      fontStyle: 'italic',
    },
    vinculoBadge: {
      marginTop: isDesktop ? theme.spacing.sm : theme.spacing.md,
      backgroundColor: theme.colors.info + '15',
      paddingVertical: isDesktop ? 4 : theme.spacing.sm,
      paddingHorizontal: isDesktop ? theme.spacing.sm : theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderLeftWidth: isDesktop ? 2 : 3,
      borderLeftColor: theme.colors.info,
    },
    vinculoBadgeText: {
      fontSize: isDesktop ? 11 : theme.typography.xs,
      color: theme.colors.info,
      fontFamily: theme.typography.fontSansSemiBold,
      lineHeight: isDesktop ? 14 : 16,
    },
  });
