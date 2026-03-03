/**
 * Skeleton loading animation component for DataTable
 */

import { memo } from 'react';
import { View, Text, DimensionValue } from 'react-native';

import { ShimmerBox } from '@/components/ShimmerBox';

import { dataTableStyles as styles } from './styles';

import type { DataTableColumn, DataTableAction } from './types';

/**
 * Animated skeleton box with shimmer effect.
 * Delegates to ShimmerBox for premium gradient shimmer on web / opacity pulse on native.
 */
export const SkeletonBox = memo(function SkeletonBox() {
  return <ShimmerBox style={styles.skeletonBox} />;
});

interface SkeletonMobileProps {
  rows: number;
  title?: string;
  testID?: string;
}

/**
 * Mobile skeleton (card-based)
 */
export const SkeletonMobile = memo(function SkeletonMobile({
  rows,
  title,
  testID,
}: SkeletonMobileProps) {
  return (
    <View style={styles.container} testID={testID}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.mobileContainer}>
        {Array.from({ length: rows }).map((_, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.cardRow}>
              <SkeletonBox />
            </View>
            <View style={styles.cardRow}>
              <SkeletonBox />
            </View>
            <View style={styles.cardRow}>
              <SkeletonBox />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

interface SkeletonDesktopProps<T> {
  rows: number;
  columns: DataTableColumn<T>[];
  actions?: DataTableAction<T>[];
  title?: string;
  testID?: string;
}

/**
 * Desktop skeleton (table-based)
 */
export function SkeletonDesktop<T>({
  rows,
  columns,
  actions,
  title,
  testID,
}: SkeletonDesktopProps<T>) {
  return (
    <View style={styles.container} testID={testID}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          {columns.map((column) => (
            <View
              key={column.key}
              style={[
                styles.tableHeaderCell,
                {
                  width: (column.width || 'auto') as DimensionValue,
                  minWidth: 100,
                },
              ]}
            >
              <SkeletonBox />
            </View>
          ))}
          {actions && actions.length > 0 && (
            <View
              style={[
                styles.tableHeaderCell,
                { width: actions.length * 100, minWidth: 180 },
              ]}
            >
              <SkeletonBox />
            </View>
          )}
        </View>

        {/* Skeleton Rows */}
        {Array.from({ length: rows }).map((_, index) => (
          <View
            key={index}
            style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}
          >
            {columns.map((column) => (
              <View
                key={column.key}
                style={[
                  styles.tableCell,
                  {
                    width: (column.width || 'auto') as DimensionValue,
                    minWidth: 100,
                  },
                ]}
              >
                <SkeletonBox />
              </View>
            ))}
            {actions && actions.length > 0 && (
              <View
                style={[
                  styles.tableCell,
                  { width: actions.length * 100, minWidth: 180 },
                ]}
              >
                <SkeletonBox />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
