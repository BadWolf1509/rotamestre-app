/**
 * DataTable - Responsive table component
 * Shows cards on mobile, table on desktop
 *
 * Modular architecture:
 * - types.ts: Type definitions
 * - useDataTableState.ts: Pagination and sorting logic
 * - SkeletonLoader.tsx: Loading skeleton components
 * - DataTablePagination.tsx: Pagination controls
 * - DataTableMobileView.tsx: Mobile card layout
 * - DataTableDesktopView.tsx: Desktop table layout
 * - styles.ts: Shared styles
 */

import { memo } from 'react';
import { View, Text } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';

import { DataTableDesktopView } from './DataTableDesktopView';
import { DataTableMobileView } from './DataTableMobileView';
import { SkeletonMobile, SkeletonDesktop } from './SkeletonLoader';
import { dataTableStyles as styles } from './styles';
import { useDataTableState } from './useDataTableState';

import type { DataTableProps, DataTableItem } from './types';

// Re-export types for external use
export type { DataTableColumn, DataTableAction, DataTableProps, DataTableItem } from './types';

function DataTableInner<T extends DataTableItem = DataTableItem>({
  data,
  columns,
  actions,
  keyExtractor,
  title,
  itemsPerPage = 10,
  pagination = true,
  emptyState,
  onSort,
  isLoading = false,
  skeletonRows = 5,
  testID,
}: DataTableProps<T>) {
  const { isMobile, isTablet } = useResponsive();
  const isMobileView = isMobile || isTablet;

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    paginatedData,
    sortColumn,
    sortDirection,
    handleSort,
    handlePreviousPage,
    handleNextPage,
  } = useDataTableState({
    data,
    itemsPerPage,
    pagination,
    onSort,
  });

  // Loading state (Skeleton)
  if (isLoading) {
    if (isMobileView) {
      return <SkeletonMobile rows={skeletonRows} title={title} testID={testID} />;
    }
    return (
      <SkeletonDesktop
        rows={skeletonRows}
        columns={columns}
        actions={actions}
        title={title}
        testID={testID}
      />
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <View style={styles.container} testID={testID}>
        {title && <Text style={styles.title}>{title}</Text>}
        {emptyState || (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhum registro encontrado</Text>
          </View>
        )}
      </View>
    );
  }

  // Mobile view (cards)
  if (isMobileView) {
    return (
      <DataTableMobileView
        data={paginatedData}
        columns={columns}
        actions={actions}
        keyExtractor={keyExtractor}
        title={title}
        currentPage={currentPage}
        totalPages={totalPages}
        pagination={pagination}
        onPrevious={handlePreviousPage}
        onNext={handleNextPage}
        testID={testID}
      />
    );
  }

  // Desktop view (table)
  return (
    <DataTableDesktopView
      data={paginatedData}
      columns={columns}
      actions={actions}
      keyExtractor={keyExtractor}
      title={title}
      currentPage={currentPage}
      totalPages={totalPages}
      startIndex={startIndex}
      endIndex={endIndex}
      totalItems={data.length}
      pagination={pagination}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      onSort={handleSort}
      onPrevious={handlePreviousPage}
      onNext={handleNextPage}
      testID={testID}
    />
  );
}

// Export memoized component
export const DataTable = memo(DataTableInner) as typeof DataTableInner;

// Default export for backwards compatibility
export default DataTable;
