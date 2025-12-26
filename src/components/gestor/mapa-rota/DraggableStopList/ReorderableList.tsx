/**
 * ReorderableList - Lista de paradas reordenáveis
 *
 * Adapter pattern que renderiza:
 * - Web: ScrollView com botões de seta
 * - Mobile: DraggableFlatList com drag-and-drop
 */

import React, { memo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Platform, Animated } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';

import { StyleSheet, type Theme } from '@/utils/styles';

import type { Parada } from '../types';

import { StopCard } from './StopCard';

export interface ReorderableListProps {
  /** Paradas a exibir */
  paradas: Parada[];
  /** Offset de ordem (número de paradas fixas) */
  orderOffset: number;
  /** Callback para mover item para cima (web) */
  onMoveUp: (index: number) => void;
  /** Callback para mover item para baixo (web) */
  onMoveDown: (index: number) => void;
  /** Callback para fim do drag (mobile) */
  onDragEnd: (data: Parada[]) => Promise<void>;
  /** Modo desktop para densidade compacta */
  isDesktop?: boolean;
}

// Componente interno para web
const WebList = memo(function WebList({
  paradas,
  orderOffset,
  onMoveUp,
  onMoveDown,
  isDesktop = false,
}: Omit<ReorderableListProps, 'onDragEnd'>) {
  // Refs para animações de feedback
  const animatedValues = useRef<Record<string, Animated.Value>>({});

  // Obter ou criar valor animado para uma parada
  const getAnimatedValue = useCallback((id: string) => {
    if (!animatedValues.current[id]) {
      animatedValues.current[id] = new Animated.Value(0);
    }
    return animatedValues.current[id];
  }, []);

  // Animar feedback ao mover (pulse effect)
  const animateMove = useCallback((id: string) => {
    const value = getAnimatedValue(id);
    // Reset first, then animate
    value.setValue(0);
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [getAnimatedValue]);

  // Handlers com animação
  const handleMoveUp = useCallback((index: number, id: string) => {
    animateMove(id);
    onMoveUp(index);
  }, [animateMove, onMoveUp]);

  const handleMoveDown = useCallback((index: number, id: string) => {
    animateMove(id);
    onMoveDown(index);
  }, [animateMove, onMoveDown]);

  return (
    <ScrollView style={styles.listContainer} showsVerticalScrollIndicator>
      {paradas.map((item, index) => (
        <StopCard
          key={item.id}
          parada={item}
          displayIndex={orderOffset + index + 1}
          variant="reorderable"
          position={{
            isFirst: index === 0,
            isLast: index === paradas.length - 1,
          }}
          onMoveUp={() => handleMoveUp(index, item.id)}
          onMoveDown={() => handleMoveDown(index, item.id)}
          animatedValue={getAnimatedValue(item.id)}
          isDesktop={isDesktop}
        />
      ))}
    </ScrollView>
  );
});

// Componente interno para mobile - usa StopCard para consistência
const MobileList = memo(function MobileList({
  paradas,
  orderOffset,
  onDragEnd,
}: Omit<ReorderableListProps, 'onMoveUp' | 'onMoveDown'>) {
  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<Parada>) => {
      const index = getIndex() ?? 0;
      const displayIndex = orderOffset + index + 1;

      return (
        <ScaleDecorator>
          <StopCard
            parada={item}
            displayIndex={displayIndex}
            variant="reorderable"
            isActive={isActive}
            onDrag={drag}
          />
        </ScaleDecorator>
      );
    },
    [orderOffset]
  );

  const handleDragEnd = useCallback(
    ({ data }: { data: Parada[] }) => {
      onDragEnd(data);
    },
    [onDragEnd]
  );

  return (
    <DraggableFlatList
      data={paradas}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onDragEnd={handleDragEnd}
      containerStyle={styles.listContainer}
    />
  );
});

// Componente principal com adapter pattern
export const ReorderableList = memo(function ReorderableList(props: ReorderableListProps) {
  const isWeb = Platform.OS === 'web';
  const { isDesktop = false } = props;

  if (props.paradas.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, isDesktop && styles.containerCompact]}>
      <View style={[styles.labelContainer, isDesktop && styles.labelContainerCompact]}>
        <Text style={[styles.labelText, isDesktop && styles.labelTextCompact]}>Pendentes</Text>
      </View>

      {isWeb ? (
        <WebList
          paradas={props.paradas}
          orderOffset={props.orderOffset}
          onMoveUp={props.onMoveUp}
          onMoveDown={props.onMoveDown}
          isDesktop={isDesktop}
        />
      ) : (
        <MobileList
          paradas={props.paradas}
          orderOffset={props.orderOffset}
          onDragEnd={props.onDragEnd}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
  containerCompact: {
    padding: theme.desktop.section.gap,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  labelContainerCompact: {
    gap: 4,
    marginBottom: 6,
  },
  labelText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelTextCompact: {
    fontSize: 10,
  },
  listContainer: {
    flex: 1,
  },
}));
