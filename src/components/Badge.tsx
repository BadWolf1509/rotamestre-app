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

const styles = StyleSheet.create(theme => ({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  small: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  medium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  large: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  text: {
    fontFamily: theme.typography.fontSansSemiBold,
  },
  smallText: {
    fontSize: theme.typography.fontSize.xs,
  },
  mediumText: {
    fontSize: theme.typography.fontSize.sm,
  },
  largeText: {
    fontSize: theme.typography.fontSize.base,
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
