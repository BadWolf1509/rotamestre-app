import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
// O `Swipeable` legado (Animated) saiu no Gesture Handler 3 (Expo SDK 58);
// o substituto é o ReanimatedSwipeable, cujo `progress` é um SharedValue.
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { IconName } from '@/types/icons';
import { mediumHaptic } from '@/utils/haptics';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

const { width: screenWidth } = Dimensions.get('window');
const SWIPE_THRESHOLD = screenWidth * 0.25;

interface SwipeAction {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  /** 'left' = abriram as ações da esquerda; 'right' = as da direita. */
  onSwipeableOpen?: (direction: 'left' | 'right') => void;
  enabled?: boolean;
}

interface AcaoDeslizeProps {
  action: SwipeAction;
  progress: SharedValue<number>;
  /** Deslocamento de partida da ação: -100 entra pela esquerda, 100 pela direita. */
  deslocamentoInicial: number;
  aoTocar: () => void;
}

// Componente de módulo (não declarado no render do SwipeableRow), porque o
// useAnimatedStyle precisa de um componente próprio por ação.
function AcaoDeslize({
  action,
  progress,
  deslocamentoInicial,
  aoTocar,
}: AcaoDeslizeProps) {
  const { theme } = useUnistyles();
  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [deslocamentoInicial, 0],
        ),
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.actionButton,
        { backgroundColor: action.color },
        estiloAnimado,
      ]}
    >
      <TouchableOpacity
        style={styles.actionContent}
        onPress={aoTocar}
        disabled={action.loading}
        accessible
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityState={{ disabled: action.loading }}
      >
        {action.loading ? (
          <ActivityIndicator color={theme.colors.white} size="small" />
        ) : (
          <Ionicons name={action.icon} size={24} color={theme.colors.white} />
        )}
        <Text style={styles.actionText}>{action.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeableOpen,
  enabled = true,
}: SwipeableRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const tocarAcao = async (action: SwipeAction) => {
    await mediumHaptic();
    swipeableRef.current?.close();
    action.onPress();
  };

  const renderActions = (
    actions: SwipeAction[],
    progress: SharedValue<number>,
    deslocamentoInicial: number,
  ) => (
    <View style={styles.actionsContainer}>
      {actions.map((action, index) => (
        <AcaoDeslize
          key={index}
          action={action}
          progress={progress}
          deslocamentoInicial={deslocamentoInicial}
          aoTocar={() => tocarAcao(action)}
        />
      ))}
    </View>
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={SWIPE_THRESHOLD}
      rightThreshold={SWIPE_THRESHOLD}
      renderLeftActions={
        leftActions.length > 0
          ? (progress) => renderActions(leftActions, progress, -100)
          : undefined
      }
      renderRightActions={
        rightActions.length > 0
          ? (progress) => renderActions(rightActions, progress, 100)
          : undefined
      }
      onSwipeableOpen={(direction) => {
        // O ReanimatedSwipeable informa o sentido do arrasto (RIGHT = arrastou
        // para a direita, abrindo as ações da ESQUERDA); o Swipeable legado
        // informava o lado aberto. Mantém o contrato antigo desta prop.
        onSwipeableOpen?.(
          direction === SwipeDirection.RIGHT ? 'left' : 'right',
        );
      }}
      overshootLeft={false}
      overshootRight={false}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    height: '100%',
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  actionText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
