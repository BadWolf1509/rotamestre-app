/**
 * ============================================
 * Badge - Componente de Badge de Status
 * ============================================
 *
 * Badge reutilizável para indicar status de rotas, tarefas, etc.
 * Usa design tokens para cores e espaçamento.
 */

import { View, Text, ViewStyle, TextStyle } from 'react-native';

import { StyleSheet, Theme, useUnistyles } from '@/utils/styles';

type BadgeStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
type BadgeSize = 'small' | 'medium' | 'large';
type BadgeVariant = 'filled' | 'outlined';

interface BadgeProps {
  status: BadgeStatus;
  label?: string;
  size?: BadgeSize;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const getBadgeColor = (theme: Theme, status: BadgeStatus) => {
  switch (status) {
    case 'pendente':
      return {
        background: theme.colors.secondaryBg,
        text: theme.colors.secondary,
      };
    case 'em_andamento':
      return {
        background: theme.colors.infoBg,
        text: theme.colors.info,
      };
    case 'concluida':
      return {
        background: theme.colors.successBg,
        text: theme.colors.success,
      };
    case 'cancelada':
      return {
        background: theme.colors.errorBg,
        text: theme.colors.error,
      };
    default:
      return {
        background: theme.colors.gray100,
        text: theme.colors.gray600,
      };
  }
};

export function Badge({
  status,
  label,
  size = 'medium',
  variant = 'filled',
  style,
}: BadgeProps) {
  const { theme } = useUnistyles();
  const { background, text } = getBadgeColor(theme, status);

  const defaultLabels = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };

  const displayLabel = label || defaultLabels[status];

  return (
    <View
      style={[
        styles.badge,
        styles[size],
        variant === 'filled'
          ? { backgroundColor: background }
          : {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: text,
            },
        style,
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${displayLabel}`}
    >
      <Text
        style={[
          styles.text,
          styles[`${size}Text` as keyof typeof styles] as TextStyle,
          { color: text },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Uses theme.components.badge tokens for density-aware sizing
  small: {
    paddingHorizontal: theme.components.badge.size.small.paddingHorizontal,
    paddingVertical: theme.components.badge.size.small.paddingVertical,
  },
  medium: {
    paddingHorizontal: theme.components.badge.size.medium.paddingHorizontal,
    paddingVertical: theme.components.badge.size.medium.paddingVertical,
  },
  large: {
    paddingHorizontal: theme.components.badge.size.large.paddingHorizontal,
    paddingVertical: theme.components.badge.size.large.paddingVertical,
  },

  text: {
    fontFamily: theme.typography.fontSansSemiBold,
  },
  smallText: {
    fontSize: theme.components.badge.size.small.fontSize,
  },
  mediumText: {
    fontSize: theme.components.badge.size.medium.fontSize,
  },
  largeText: {
    fontSize: theme.components.badge.size.large.fontSize,
  },
}));

// Export default para facilitar import
export default Badge;

/**
 * ============================================
 * EXEMPLO DE USO
 * ============================================
 *
 * import Badge from '@/components/Badge';
 *
 * // Badge básico
 * <Badge status="em_andamento" />
 *
 * // Badge com label customizado
 * <Badge status="concluida" label="Finalizado" />
 *
 * // Badge pequeno
 * <Badge status="pendente" size="small" />
 *
 * // Badge outlined
 * <Badge status="cancelada" variant="outlined" />
 *
 * // Badge com estilo customizado
 * <Badge status="em_andamento" style={{ marginLeft: 8 }} />
 */
