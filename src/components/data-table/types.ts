/**
 * DataTable type definitions
 */

import type { IconName } from '@/types/icons';

import type React from 'react';


/**
 * Column definition for DataTable
 */
export interface DataTableColumn<T = any> {
  /** Unique column identifier */
  key: string;
  /** Header label */
  label: string;
  /** Column width (desktop only) - ex: 100, '20%', 'auto' */
  width?: number | string;
  /** Custom render function */
  render?: (item: T) => React.ReactNode;
  /** Enable sorting? */
  sortable?: boolean;
  /** Content alignment */
  align?: 'left' | 'center' | 'right';
  /** Show only on desktop? */
  desktopOnly?: boolean;
  /** Prevent line wrap and apply ellipsis */
  noWrap?: boolean;
}

/**
 * Action definition for DataTable rows
 */
export interface DataTableAction<T = any> {
  /** Action label (string or function returning string based on item) */
  label: string | ((item: T) => string);
  /** Icon (IconName or function returning IconName based on item) */
  icon?: IconName | ((item: T) => IconName);
  /** Click callback */
  onPress: (item: T) => void;
  /** Button color */
  color?: string;
  /** Action type */
  type?: 'primary' | 'secondary' | 'danger';
}

/**
 * DataTable component props
 */
export interface DataTableProps<T = any> {
  /** Data to display */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Row actions */
  actions?: DataTableAction<T>[];
  /** Function to get unique key for each item */
  keyExtractor: (item: T) => string;
  /** Table title (optional) */
  title?: string;
  /** Items per page */
  itemsPerPage?: number;
  /** Show pagination? */
  pagination?: boolean;
  /** Custom empty state */
  emptyState?: React.ReactNode;
  /** Callback when sort changes */
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  /** Loading state (shows skeleton) */
  isLoading?: boolean;
  /** Number of skeleton rows during loading */
  skeletonRows?: number;
  testID?: string;
}

/**
 * Internal state for DataTable hook
 */
export interface DataTableState<T> {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  paginatedData: T[];
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  handleSort: (columnKey: string) => void;
  handlePreviousPage: () => void;
  handleNextPage: () => void;
}
