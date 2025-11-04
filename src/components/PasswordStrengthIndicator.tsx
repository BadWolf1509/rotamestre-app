import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { validatePasswordStrength } from '@/utils/passwordValidation';

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

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  barContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  feedbackContainer: {
    marginTop: 8,
  },
  feedbackText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});
