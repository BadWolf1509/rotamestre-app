/**
 * Skeleton loading animation component for DataTable
 */

import { memo } from 'react';
import { View, Text } from 'react-native';

import { ShimmerBox } from '@/components/ShimmerBox';

import { larguraDaColuna, larguraDaColunaDeAcoes } from './larguras';
import { dataTableStyles as styles } from './styles';

import type { DataTableColumn, DataTableAction } from './types';

/**
 * Animated skeleton box with shimmer effect.
 * Delegates to ShimmerBox for premium gradient shimmer on web / opacity pulse on native.
 */
const SkeletonBox = memo(function SkeletonBox() {
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
 * Desktop skeleton (table-based). Colunas e coluna de ações com as larguras
 * da tabela real (`larguras.ts`): nada salta quando os dados chegam.
 */
export function SkeletonDesktop<T>({
  rows,
  columns,
  actions,
  title,
  testID,
}: SkeletonDesktopProps<T>) {
  const temAcoes = !!actions && actions.length > 0;
  const estiloColunaAcoes = larguraDaColunaDeAcoes(actions);

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
                larguraDaColuna(column.width, column.minWidth),
              ]}
            >
              <SkeletonBox />
            </View>
          ))}
          {temAcoes && (
            <View style={[styles.tableHeaderCell, estiloColunaAcoes]}>
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
                  larguraDaColuna(column.width, column.minWidth),
                ]}
              >
                <SkeletonBox />
              </View>
            ))}
            {temAcoes && (
              <View style={[styles.tableCell, estiloColunaAcoes]}>
                <SkeletonBox />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
