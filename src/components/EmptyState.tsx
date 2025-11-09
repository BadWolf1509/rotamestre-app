/**
 * ============================================
 * EmptyState - Componente de Estado Vazio
 * ============================================
 *
 * Componente para exibir quando não há dados disponíveis.
 * Usa design tokens para cores, tipografia e espaçamento.
 */

import { Ionicons } from '@expo/vector-icons';
import { View, Text, ViewStyle } from 'react-native';

import { StyleSheet, useUnistyles } from '@/utils/styles';

import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onActionPress,
  style,
}: EmptyStateProps) {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.container, style]}>
      <Ionicons
        name={icon}
        size={64}
        color={theme.colors.gray400}
        style={styles.icon}
      />

      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Description */}
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}

      {/* Action Button */}
      {actionLabel && onActionPress && (
        <Button
          title={actionLabel}
          onPress={onActionPress}
          variant="primary"
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },

  icon: {
    marginBottom: theme.spacing.lg,
  },

  title: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * 1.5,
    color: theme.colors.gray900,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },

  description: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    maxWidth: 300,
  },

  button: {
    marginTop: theme.spacing.sm,
  },
}));

// Export default para facilitar import
export default EmptyState;

/**
 * ============================================
 * EXEMPLOS DE USO
 * ============================================
 *
 * import EmptyState from '@/components/EmptyState';
 *
 * // Empty state básico
 * <EmptyState
 *   title="Nenhuma rota encontrada"
 *   description="Crie sua primeira rota para começar a otimizar suas entregas"
 * />
 *
 * // Empty state com ação
 * <EmptyState
 *   icon="add-circle-outline"
 *   title="Nenhum motorista cadastrado"
 *   description="Adicione motoristas para gerenciar suas rotas de entrega"
 *   actionLabel="Adicionar Motorista"
 *   onActionPress={() => navigation.navigate('NovoMotorista')}
 * />
 *
 * // Empty state de busca
 * <EmptyState
 *   icon="search-outline"
 *   title="Nenhum resultado encontrado"
 *   description="Tente usar outros termos de busca"
 * />
 *
 * // Empty state de erro
 * <EmptyState
 *   icon="alert-circle-outline"
 *   title="Erro ao carregar dados"
 *   description="Ocorreu um erro ao buscar as informações. Tente novamente."
 *   actionLabel="Tentar Novamente"
 *   onActionPress={() => refetch()}
 * />
 *
 * // Empty state de lista vazia
 * <EmptyState
 *   icon="calendar-outline"
 *   title="Sem rotas para hoje"
 *   description="Não há rotas programadas para hoje. Aproveite para planejar as próximas."
 * />
 */
