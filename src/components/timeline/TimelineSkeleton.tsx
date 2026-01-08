/**
 * TimelineSkeleton - Loading skeleton for timeline
 */

import React, { memo } from 'react';
import { View } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

interface TimelineSkeletonProps {
  showFilters?: boolean;
}

function TimelineSkeletonComponent({ showFilters = true }: TimelineSkeletonProps) {
  return (
    <View style={styles.container}>
      {/* Skeleton Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filtersContent}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonFilterChip} />
            ))}
          </View>
        </View>
      )}

      {/* Skeleton Date Header */}
      <View style={styles.skeletonDateHeader}>
        <View style={styles.skeletonDateLine} />
        <View style={styles.skeletonDateText} />
        <View style={styles.skeletonDateLine} />
      </View>

      {/* Skeleton Events */}
      {[1, 2, 3, 4].map((i, index) => (
        <View key={i} style={styles.eventContainer}>
          {/* Timeline line */}
          {index < 3 && <View style={styles.timelineLine} />}

          {/* Skeleton Icon */}
          <View style={styles.skeletonIcon} />

          {/* Skeleton Content */}
          <View style={styles.skeletonContent}>
            <View style={styles.skeletonHeader}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonTimestamp} />
            </View>
            <View style={styles.skeletonDescription} />
            {i % 2 === 0 && <View style={styles.skeletonDescriptionShort} />}
          </View>
        </View>
      ))}
    </View>
  );
}

export const TimelineSkeleton = memo(TimelineSkeletonComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
  },
  filtersContainer: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  filtersContent: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  skeletonFilterChip: {
    width: 70,
    height: 28,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.gray200,
    marginRight: theme.spacing.sm,
  },
  skeletonDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  skeletonDateLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray200,
  },
  skeletonDateText: {
    width: 50,
    height: theme.typography.fontSize.xs,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
  },
  eventContainer: {
    flexDirection: 'row',
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 35,
    top: 40,
    bottom: -16,
    width: 2,
    backgroundColor: theme.colors.gray200,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray200,
    marginRight: theme.spacing.lg,
  },
  skeletonContent: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  skeletonTitle: {
    width: 120,
    height: theme.typography.fontSize.sm,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
  },
  skeletonTimestamp: {
    width: 50,
    height: theme.typography.fontSize.xs,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
  },
  skeletonDescription: {
    width: '100%',
    height: theme.typography.fontSize.xs,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
  },
  skeletonDescriptionShort: {
    width: '60%',
    height: theme.typography.fontSize.xs,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
    marginTop: theme.spacing.xs + 2,
  },
}));
