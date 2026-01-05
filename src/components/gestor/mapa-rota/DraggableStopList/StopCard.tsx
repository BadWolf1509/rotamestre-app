/**
 * StopCard - Componente de card de parada reutilizável
 *
 * Renderiza uma parada com suporte a:
 * - Modo fixo (concluída/pulada) - visual esmaecido com cadeado
 * - Modo reordenável (pendente) - visual destacado com controles
 * - Controles de reordenação (setas web / drag handle mobile)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Platform, Animated } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { Parada } from '../types';

export interface StopCardProps {
  parada: Parada;
  /** Número de ordem a exibir */
  displayIndex: number;
  /** Modo de exibição */
  variant: 'fixed' | 'reorderable';
  /** Se o card está sendo arrastado (mobile) */
  isActive?: boolean;
  /** Posição na lista (para controles de seta) */
  position?: {
    isFirst: boolean;
    isLast: boolean;
  };
  /** Callbacks para web */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Callback para iniciar drag (mobile) */
  onDrag?: () => void;
  /** Valor de animação para feedback visual */
  animatedValue?: Animated.Value;
  /** Modo desktop para densidade compacta */
  isDesktop?: boolean;
}

export const StopCard = memo(function StopCard({
  parada,
  displayIndex,
  variant,
  isActive = false,
  position,
  onMoveUp,
  onMoveDown,
  onDrag,
  animatedValue,
  isDesktop = false,
}: StopCardProps) {
  const { theme } = useUnistyles();
  const isFixed = variant === 'fixed';
  const isCompleted = parada.status === 'concluida';
  const isWeb = Platform.OS === 'web';

  // Cor do badge baseada no status
  const badgeColor = isFixed
    ? isCompleted
      ? theme.colors.success
      : theme.colors.gray400
    : theme.colors.warning;

  // Estilo animado para feedback visual (scale + translateX pulse)
  const animatedStyle = animatedValue
    ? {
        transform: [
          {
            scale: animatedValue.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.02, 1],
            }),
          },
          {
            translateX: animatedValue.interpolate({
              inputRange: [0, 0.25, 0.5, 0.75, 1],
              outputRange: [0, -2, 0, 2, 0],
            }),
          },
        ],
        opacity: animatedValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 0.85, 1],
        }),
      }
    : undefined;

  const CardContainer = animatedValue ? Animated.View : View;

  return (
    <CardContainer
      style={[
        isFixed ? styles.fixedItem : styles.draggableItem,
        isDesktop && (isFixed ? styles.fixedItemCompact : styles.draggableItemCompact),
        isActive && styles.draggableItemActive,
        animatedStyle,
      ]}
    >
      {/* Controles de reordenação */}
      {!isFixed && isWeb && position && (
        <View style={[styles.webMoveButtons, isDesktop && styles.webMoveButtonsCompact]}>
          <TouchableOpacity
            style={[
              styles.moveButton,
              isDesktop && styles.moveButtonCompact,
              position.isFirst && styles.moveButtonDisabled,
            ]}
            onPress={onMoveUp}
            disabled={position.isFirst}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-up"
              size={isDesktop ? 14 : 18}
              color={position.isFirst ? theme.colors.gray300 : theme.colors.secondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.moveButton,
              isDesktop && styles.moveButtonCompact,
              position.isLast && styles.moveButtonDisabled,
            ]}
            onPress={onMoveDown}
            disabled={position.isLast}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-down"
              size={isDesktop ? 14 : 18}
              color={position.isLast ? theme.colors.gray300 : theme.colors.secondary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Drag handle (mobile apenas) */}
      {!isFixed && !isWeb && (
        <View
          style={styles.dragHandle}
          onTouchStart={onDrag}
        >
          <Ionicons
            name="reorder-three"
            size={24}
            color={isActive ? theme.colors.primary : theme.colors.gray400}
          />
        </View>
      )}

      {/* Badge de ordem */}
      <View style={[styles.orderBadge, isDesktop && styles.orderBadgeCompact, { backgroundColor: badgeColor }]}>
        <Text style={[styles.orderText, isDesktop && styles.orderTextCompact]}>{displayIndex}</Text>
      </View>

      {/* Conteúdo principal */}
      <View style={styles.itemContent}>
        <Text style={[styles.itemAddress, isDesktop && styles.itemAddressCompact]} numberOfLines={1}>
          {parada.endereco}
        </Text>

        {isFixed ? (
          // Status para paradas fixas
          <View style={styles.statusRow}>
            <Ionicons
              name={isCompleted ? 'checkmark-circle' : 'close-circle'}
              size={isDesktop ? 12 : 14}
              color={badgeColor}
            />
            <Text style={[styles.statusText, isDesktop && styles.statusTextCompact, { color: badgeColor }]}>
              {isCompleted ? 'Concluída' : 'Pulada'}
            </Text>
          </View>
        ) : (
          // Meta info para paradas reordenáveis
          <View style={[styles.metaRow, isDesktop && styles.metaRowCompact]}>
            {parada.destinatario && (
              <Text style={[styles.metaText, isDesktop && styles.metaTextCompact]} numberOfLines={1}>
                {parada.destinatario}
              </Text>
            )}
            <View
              style={[
                styles.typeTag,
                isDesktop && styles.typeTagCompact,
                parada.tipo === 'entrega' ? styles.typeTagEntrega : styles.typeTagRetirada,
              ]}
            >
              <Text
                style={[
                  styles.typeTagText,
                  isDesktop && styles.typeTagTextCompact,
                  parada.tipo === 'entrega'
                    ? styles.typeTagTextEntrega
                    : styles.typeTagTextRetirada,
                ]}
              >
                {parada.tipo === 'entrega' ? 'ENT' : 'RET'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Ícone de cadeado apenas para paradas fixas */}
      {isFixed && (
        <View style={[styles.lockIcon, isDesktop && styles.lockIconCompact]}>
          <Ionicons name="lock-closed" size={isDesktop ? 12 : 16} color={theme.colors.gray400} />
        </View>
      )}
    </CardContainer>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  // Base styles
  fixedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray100,
    padding: theme.spacing['2.5'],
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    opacity: 0.7,
  },
  fixedItemCompact: {
    padding: theme.spacing['1.5'],
    marginBottom: theme.spacing['1.5'],
    gap: theme.spacing['1.5'],
    borderRadius: theme.borderRadius.sm,
  },
  draggableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing['2.5'],
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  draggableItemCompact: {
    padding: theme.spacing['1.5'],
    marginBottom: theme.spacing['1.5'],
    gap: theme.spacing['1.5'],
    borderRadius: theme.borderRadius.sm,
  },
  draggableItemActive: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    backgroundColor: theme.colors.primaryBg || `${theme.colors.primary}10`,
  },
  dragHandle: {
    padding: theme.spacing.xs,
  },
  // Order badge
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderBadgeCompact: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  orderText: {
    color: theme.colors.white,
    fontSize: theme.typography.xs + 1,
    fontFamily: theme.typography.fontSansBold,
  },
  orderTextCompact: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
  },
  // Content
  itemContent: {
    flex: 1,
    gap: theme.spacing['0.5'],
  },
  itemAddress: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  itemAddressCompact: {
    fontSize: theme.desktop.input.fontSize,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  statusText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansMedium,
  },
  statusTextCompact: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  metaRowCompact: {
    gap: theme.spacing['1.5'],
  },
  metaText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray600,
    maxWidth: 150,
  },
  metaTextCompact: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
    maxWidth: 120,
  },
  // Type tag
  typeTag: {
    paddingHorizontal: theme.spacing['1.5'],
    paddingVertical: theme.spacing['0.5'],
    borderRadius: theme.borderRadius.xs,
  },
  typeTagCompact: {
    paddingHorizontal: theme.spacing['1'],
    paddingVertical: 1,
    borderRadius: 3,
  },
  typeTagEntrega: {
    backgroundColor: theme.colors.infoBg,
  },
  typeTagRetirada: {
    backgroundColor: theme.colors.warningBg,
  },
  typeTagText: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
    fontFamily: theme.typography.fontSansBold,
    letterSpacing: 0.3,
  },
  typeTagTextCompact: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
    letterSpacing: 0.2,
  },
  typeTagTextEntrega: {
    color: theme.colors.info,
  },
  typeTagTextRetirada: {
    color: theme.colors.warning,
  },
  // Icons
  lockIcon: {
    padding: theme.spacing.xs,
  },
  lockIconCompact: {
    padding: theme.spacing['0.5'],
  },
  // Web move buttons
  webMoveButtons: {
    flexDirection: 'column',
    gap: theme.spacing['0.5'],
  },
  webMoveButtonsCompact: {
    gap: 1,
  },
  moveButton: {
    padding: theme.spacing['1'],
    borderRadius: theme.borderRadius.xs,
    backgroundColor: theme.colors.gray100,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    }),
  },
  moveButtonCompact: {
    padding: theme.spacing['0.5'],
    borderRadius: 3,
  },
  moveButtonDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
}));
