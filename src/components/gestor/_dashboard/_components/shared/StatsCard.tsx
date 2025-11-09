import { View, Text } from 'react-native';

import { StyleSheet } from '@/utils/styles';

interface StatsCardProps {
  value: string | number;
  label: string;
  backgroundColor: string;
}

/**
 * Card de estatística compartilhado entre mobile e desktop
 */
export function StatsCard({ value, label, backgroundColor }: StatsCardProps) {
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  value: {
    fontSize: 32,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  label: {
    fontSize: theme.typography.xs,
    color: theme.colors.white,
    marginTop: 4,
    opacity: 0.9,
  },
}));
