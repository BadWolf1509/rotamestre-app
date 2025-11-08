/**
 * ============================================
 * Badge - Componente de Badge de Status
 * ============================================
 *
 * Badge reutilizável para indicar status de rotas, tarefas, etc.
 * Usa design tokens para cores e espaçamento.
 */

import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { StyleSheet } from '@/utils/styles';

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

const getBadgeColor = (status: BadgeStatus) => {
  switch (status) {
    case 'pendente':
      return {
        background: '#FEF3C7',
        text: '#f59e0b',
      };
    case 'em_andamento':
      return {
        background: '#DBEAFE',
        text: '#3b82f6',
      };
    case 'concluida':
      return {
        background: '#D1FAE5',
        text: '#10b981',
      };
    case 'cancelada':
      return {
        background: '#FEE2E2',
        text: '#ef4444',
      };
    default:
      return {
        background: '#f3f4f6',
        text: '#4b5563',
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
  const { background, text } = getBadgeColor(status);

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
