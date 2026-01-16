/**
 * DialogDestructiveInput - Confirmation input for destructive actions
 * Requires user to type specific text to confirm dangerous operations
 */
import { memo } from 'react';
import { View, Text, TextInput } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface DialogDestructiveInputProps {
  /** Required text to type for confirmation */
  confirmText: string;
  /** Current input value */
  value: string;
  /** Change handler */
  onChangeText: (text: string) => void;
  /** Whether input is valid (matches confirmText) */
  isValid: boolean;
  /** Whether input is disabled */
  disabled?: boolean;
}

/**
 * Destructive confirmation input component
 * Memoized to prevent unnecessary re-renders
 */
export const DialogDestructiveInput = memo(function DialogDestructiveInput({
  confirmText,
  value,
  onChangeText,
  isValid,
  disabled = false,
}: DialogDestructiveInputProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Digite <Text style={styles.highlight}>{confirmText}</Text> para confirmar:
      </Text>
      <TextInput
        style={[
          styles.input,
          value.length > 0 && !isValid && styles.inputError,
          isValid && value.length > 0 && styles.inputValid,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={confirmText}
        placeholderTextColor={theme.colors.gray400}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!disabled}
      />
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: `${theme.colors.error}08`,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: `${theme.colors.error}20`,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.sm,
  },
  highlight: {
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.error,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    letterSpacing: 1,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: `${theme.colors.error}05`,
  },
  inputValid: {
    borderColor: theme.colors.success,
    backgroundColor: `${theme.colors.success}05`,
  },
}));

export default DialogDestructiveInput;
