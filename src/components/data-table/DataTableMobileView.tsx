/**
 * Mobile view (cards) for DataTable
 */

import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { PaginationMobile } from './DataTablePagination';
import { dataTableStyles as styles } from './styles';

import type { DataTableColumn, DataTableAction } from './types';

interface DataTableMobileViewProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  actions?: DataTableAction<T>[];
  keyExtractor: (item: T) => string;
  title?: string;
  currentPage: number;
  totalPages: number;
  pagination: boolean;
  onPrevious: () => void;
  onNext: () => void;
  testID?: string;
}

function DataTableMobileViewInner<T>({
  data,
  columns,
  actions,
  keyExtractor,
  title,
  currentPage,
  totalPages,
  pagination,
  onPrevious,
  onNext,
  testID,
}: DataTableMobileViewProps<T>) {
  const { theme } = useUnistyles();

  // Filter columns for mobile (exclude desktopOnly)
  const mobileColumns = useMemo(() => {
    return columns.filter((col) => !col.desktopOnly);
  }, [columns]);

  return (
    <View style={styles.container} testID={testID}>
      {title && <Text style={styles.title}>{title}</Text>}

      <ScrollView style={styles.mobileContainer}>
        {data.map((item) => (
          <View key={keyExtractor(item)} style={styles.card}>
            {/* Card data rows */}
            {mobileColumns.map((column) => {
              const renderedContent = column.render
                ? column.render(item)
                : (item as any)[column.key];
              const isReactElement =
                typeof renderedContent === 'object' &&
                renderedContent !== null &&
                typeof renderedContent !== 'string';

              return (
                <View key={column.key} style={styles.cardRow}>
                  <Text style={styles.cardLabel}>{column.label}:</Text>
                  {isReactElement ? (
                    renderedContent
                  ) : (
                    <Text style={styles.cardValue}>{renderedContent}</Text>
                  )}
                </View>
              );
            })}

            {/* Actions */}
            {actions && actions.length > 0 && (
              <View style={styles.cardActions}>
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
                        styles.cardActionButton,
                        action.type === 'danger' && styles.cardActionButtonDanger,
                        action.type === 'secondary' &&
                          styles.cardActionButtonSecondary,
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
                          styles.cardActionText,
                          action.type === 'danger' && styles.cardActionTextDanger,
                          action.type === 'secondary' &&
                            styles.cardActionTextSecondary,
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
      </ScrollView>

      {/* Mobile Pagination */}
      {pagination && (
        <PaginationMobile
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevious={onPrevious}
          onNext={onNext}
        />
      )}
    </View>
  );
}

export const DataTableMobileView = memo(
  DataTableMobileViewInner
) as typeof DataTableMobileViewInner;
