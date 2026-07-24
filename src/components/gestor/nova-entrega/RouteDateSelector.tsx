import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface RouteDateSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

function toLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const RouteDateSelector = memo(function RouteDateSelector({
  value,
  onChange,
}: RouteDateSelectorProps) {
  const { theme } = useUnistyles();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Data da rota *</Text>
      <View style={styles.inputRow}>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={theme.colors.gray500}
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="AAAA-MM-DD"
          maxLength={10}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="Data da rota no formato ano, mês e dia"
        />
      </View>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => onChange(toLocalDate(today))}
          accessibilityRole="button"
        >
          <Text style={styles.quickButtonText}>Hoje</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => onChange(toLocalDate(tomorrow))}
          accessibilityRole="button"
        >
          <Text style={styles.quickButtonText}>Amanhã</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
    marginBottom: theme.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    minHeight: 46,
  },
  input: {
    flex: 1,
    color: theme.colors.gray900,
    fontSize: theme.typography.base,
    minHeight: 44,
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  quickButton: {
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  quickButtonText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
}));
