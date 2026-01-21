/**
 * Desktop view (table) for DataTable
 */

import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  DimensionValue,
} from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { PaginationDesktop } from './DataTablePagination';
import { dataTableStyles as styles } from './styles';
import { getColumnDisplayValue } from './types';

import type { DataTableColumn, DataTableAction, DataTableItem } from './types';

interface DataTableDesktopViewProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  actions?: DataTableAction<T>[];
  keyExtractor: (item: T) => string;
  title?: string;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  pagination: boolean;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (columnKey: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  testID?: string;
}

function DataTableDesktopViewInner<T>({
  data,
  columns,
  actions,
  keyExtractor,
  title,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  pagination,
  sortColumn,
  sortDirection,
  onSort,
  onPrevious,
  onNext,
  testID,
}: DataTableDesktopViewProps<T>) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container} testID={testID}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.tableContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              {columns.map((column) => (
                <TouchableOpacity
                  key={column.key}
                  style={[
                    styles.tableHeaderCell,
                    {
                      width: (column.width || 'auto') as DimensionValue,
                      minWidth: 100,
                    },
                    column.align === 'center' && { alignItems: 'center' },
                    column.align === 'right' && { alignItems: 'flex-end' },
                  ]}
                  onPress={() => column.sortable && onSort(column.key)}
                  disabled={!column.sortable}
                >
                  <Text style={styles.tableHeaderText}>{column.label}</Text>
                  {column.sortable && sortColumn === column.key && (
                    <Text style={styles.sortIndicator}>
                      {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
              {actions && actions.length > 0 && (
                <View
                  style={[
                    styles.tableHeaderCell,
                    { width: actions.length * 100, minWidth: 180 },
                  ]}
                >
                  <Text style={styles.tableHeaderText}>Ações</Text>
                </View>
              )}
            </View>

            {/* Table Body */}
            {data.map((item, index) => (
              <View
                key={keyExtractor(item)}
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
                      column.align === 'center' && { alignItems: 'center' },
                      column.align === 'right' && { alignItems: 'flex-end' },
                    ]}
                  >
                    {column.render ? (
                      column.render(item)
                    ) : (
                      <Text
                        style={[
                          styles.tableCellText,
                          column.noWrap && styles.tableCellTextNoWrap,
                        ]}
                        numberOfLines={column.noWrap ? 1 : undefined}
                        ellipsizeMode={column.noWrap ? 'tail' : undefined}
                      >
                        {getColumnDisplayValue(item as DataTableItem, column.key)}
                      </Text>
                    )}
                  </View>
                ))}

                {/* Desktop Actions */}
                {actions && actions.length > 0 && (
                  <View style={[styles.tableCell, styles.tableCellActions]}>
                    {actions.map((action, idx) => {
                      const label =
                        typeof action.label === 'function'
                          ? action.label(item)
                          : action.label;
                      const icon = action.icon
                        ? typeof action.icon === 'function'
                          ? action.icon(item)
                          : action.icon
                        : undefined;

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.tableActionButton,
                            action.type === 'danger' &&
                              styles.tableActionButtonDanger,
                            action.type === 'secondary' &&
                              styles.tableActionButtonSecondary,
                          ]}
                          onPress={() => action.onPress(item)}
                        >
                          {icon && (
                            <Ionicons
                              name={icon}
                              size={16}
                              color={
                                action.type === 'danger'
                                  ? theme.colors.error
                                  : action.type === 'secondary'
                                    ? theme.colors.gray600
                                    : theme.colors.primary
                              }
                            />
                          )}
                          <Text
                            style={[
                              styles.tableActionText,
                              action.type === 'danger' &&
                                styles.tableActionTextDanger,
                              action.type === 'secondary' &&
                                styles.tableActionTextSecondary,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Desktop Pagination */}
        {pagination && (
          <PaginationDesktop
            currentPage={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
            onPrevious={onPrevious}
            onNext={onNext}
          />
        )}
      </View>
    </View>
  );
}

export const DataTableDesktopView = memo(
  DataTableDesktopViewInner
) as typeof DataTableDesktopViewInner;
