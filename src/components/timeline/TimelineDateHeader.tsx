/**
 * TimelineDateHeader - Date group header for timeline
 */

import React, { memo } from 'react';
import { View, Text } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

interface TimelineDateHeaderProps {
  date: string;
}

function TimelineDateHeaderComponent({ date }: TimelineDateHeaderProps) {
  return (
    <View style={styles.dateHeader}>
      <View style={styles.dateHeaderLine} />
      <Text style={styles.dateHeaderText}>{date}</Text>
      <View style={styles.dateHeaderLine} />
    </View>
  );
}

export const TimelineDateHeader = memo(TimelineDateHeaderComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray200,
  },
  dateHeaderText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    paddingHorizontal: theme.spacing.md,
    textTransform: 'uppercase',
  },
}));
