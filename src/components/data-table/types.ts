/**
 * DataTable type definitions
 */

import type { IconName } from '@/types/icons';

import type React from 'react';

/**
 * Base type for DataTable items - allows any object type
 * Using 'object' constraint for flexibility with TypeScript interfaces
 */
export type DataTableItem = object;

/**
 * Column definition for DataTable
 */
export interface DataTableColumn<T = DataTableItem> {
  /** Unique column identifier */
  key: string;
  /** Header label */
  label: string;
  /**
   * Largura-base da coluna (só desktop), ex.: 100, '20%'. Número: a coluna
   * parte dessa largura e cresce ou encolhe na mesma proporção das outras
   * (`flexGrow`/`flexShrink: width`) para caber no cartão.
   */
  width?: number | string;
  /**
   * Até onde a coluna encolhe (só desktop, com `width` numérico). Sem ele,
   * ela não encolhe abaixo de `width`. Abaixo da soma dos mínimos, a tabela
   * rola na horizontal.
   */
  minWidth?: number;
  /** Custom render function */
  render?: (item: T) => React.ReactNode;
  /**
   * Texto da coluna no rótulo acessível da linha (desktop). Sem ele, o rótulo
   * usa `item[key]`; com `render` e uma `key` que não é campo do item, passe
   * `rotulo` para a coluna não sumir (ou sair vazia) do que o leitor de tela lê.
   */
  rotulo?: (item: T) => string;
  /** Enable sorting? */
  sortable?: boolean;
  /** Content alignment */
  align?: 'left' | 'center' | 'right';
  /** Show only on desktop? */
  desktopOnly?: boolean;
}

/**
 * Type-safe column accessor for DataTable
 * Use this when accessing item[column.key] to avoid scattered 'as any' casts
 */
export function getColumnDisplayValue(
  item: DataTableItem,
  key: string,
): string | number | null | undefined {
  // Safe type assertion - item is always an object from DataTable
  const record = item as Record<string, unknown>;
  const value = record[key];
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number') return value;
  // For complex values, convert to string
  return String(value);
}

/**
 * Action definition for DataTable rows
 */
export interface DataTableAction<T = DataTableItem> {
  /** Action label (string or function returning string based on item) */
  label: string | ((item: T) => string);
  /** Icon (IconName or function returning IconName based on item) */
  icon?: IconName | ((item: T) => IconName);
  /** Click callback */
  onPress: (item: T) => void;
  /** Button color */
  color?: string;
  /**
   * Action type. No desktop, `danger` não fica na linha: vai para o menu
   * "Mais ações" (⋯). O mobile continua mostrando todas como botão.
   */
  type?: 'primary' | 'secondary' | 'danger';
  /**
   * No desktop, manda a ação para o menu "Mais ações" (⋯) mesmo sem ser
   * `danger`, para a coluna de ações caber. O mobile não muda.
   */
  emMenu?: boolean;
}

/**
 * DataTable component props
 */
export interface DataTableProps<T extends DataTableItem = DataTableItem> {
  /** Data to display */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Row actions */
  actions?: DataTableAction<T>[];
  /**
   * Toque/clique na linha (só desktop). As ações da linha e o menu "⋯"
   * interrompem a propagação, então não disparam este callback.
   */
  onRowPress?: (item: T) => void;
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
