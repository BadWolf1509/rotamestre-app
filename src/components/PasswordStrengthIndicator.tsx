import React from 'react';
import { View, Text } from 'react-native';

import { validatePasswordStrength } from '@/utils/passwordValidation';
import { StyleSheet, type Theme } from '@/utils/styles';

interface Props {
  password: string;
}

export function PasswordStrengthIndicator({ password }: Props) {
  if (!password) return null;

  const { score, label, color, feedback } = validatePasswordStrength(password);

  const barWidth = `${(score / 5) * 100}%`;

  return (
    <View style={styles.container}>
      {/* Barra de progresso */}
      <View style={styles.barContainer}>
        <View style={[styles.bar, { width: barWidth, backgroundColor: color }]} />
      </View>

      {/* Label */}
      <Text style={[styles.label, { color }]}>
        Força: {label}
      </Text>

      {/* Feedback */}
      {feedback.length > 0 && (
        <View style={styles.feedbackContainer}>
          {feedback.map((item, index) => (
            <Text key={index} style={styles.feedbackText}>
              • {item}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    marginTop: theme.spacing.xs,
  },
  barContainer: {
    height: 4,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.xs,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: theme.borderRadius.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  feedbackContainer: {
    marginTop: theme.spacing.xs,
  },
  feedbackText: {
    fontSize: 12,
    color: theme.colors.gray500,
    marginTop: 2,
  },
}));
