import { Text } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

interface FieldErrorProps {
  message?: string;
}

/**
 * Erro de validação inline por campo (forms de auth).
 * Retorna null quando não há mensagem → sem shift de layout no estado default.
 */
export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return <Text style={styles.fieldError}>{message}</Text>;
}

const styles = StyleSheet.create((theme: Theme) => ({
  fieldError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    marginTop: theme.spacing.xs,
  },
}));
