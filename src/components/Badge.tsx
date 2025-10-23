/**
 * ============================================
 * Badge - Componente de Badge de Status
 * ============================================
 *
 * Badge reutilizável para indicar status de rotas, tarefas, etc.
 * Usa design tokens para cores e espaçamento.
 */

import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { borderRadius, typography, getBadgeColor } from '@/lib/design-tokens';

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

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tamanhos
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

  // Textos
  text: {
    fontFamily: typography.fontFamily.semibold,
  },
  smallText: {
    fontSize: typography.fontSize.xs, // 12px
  },
  mediumText: {
    fontSize: typography.fontSize.sm, // 14px
  },
  largeText: {
    fontSize: typography.fontSize.md, // 16px
  },
});

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
