import React from 'react';
import { View, Text } from 'react-native';

import { StyleSheet, useUnistyles } from '@/utils/styles';

interface StatusSectionProps {
  userName?: string;
  unitName?: string;
}

export function StatusSection({ userName = 'Motorista', unitName }: StatusSectionProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles(theme).header}>
      <View style={styles(theme).headerTextContainer}>
        <Text style={styles(theme).headerTitle}>
          Olá, {userName}!
        </Text>
        {unitName && (
          <Text style={styles(theme).headerSubtitle}>
            {unitName}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = (theme: any) => StyleSheet.create({
  header: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTextContainer: {
    width: '100%',
  },
  headerTitle: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 4,
  },
});
