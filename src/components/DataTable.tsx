import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  DimensionValue,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import type { IconName } from '@/types/icons';
import { boxShadow } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// ============================================
// TYPES
// ============================================

export interface DataTableColumn<T = any> {
  /** Identificador único da coluna */
  key: string;
  /** Label exibido no header */
  label: string;
  /** Largura da coluna (apenas desktop) - ex: 100, '20%', 'auto' */
  width?: number | string;
  /** Função para renderizar o valor */
  render?: (item: T) => React.ReactNode;
  /** Permitir ordenação? */
  sortable?: boolean;
  /** Alinhamento do conteúdo */
  align?: 'left' | 'center' | 'right';
  /** Mostrar apenas em desktop? */
  desktopOnly?: boolean;
  /** Impedir quebra de linha e aplicar reticências */
  noWrap?: boolean;
}

export interface DataTableAction<T = any> {
  /** Label da ação (string ou função que retorna string baseada no item) */
  label: string | ((item: T) => string);
  /** Ícone (emoji ou texto, IconName ou função que retorna IconName baseada no item) */
  icon?: IconName | ((item: T) => IconName);
  /** Callback ao clicar */
  onPress: (item: T) => void;
  /** Cor do botão */
  color?: string;
  /** Tipo de ação */
  type?: 'primary' | 'secondary' | 'danger';
}

export interface DataTableProps<T = any> {
  /** Dados a serem exibidos */
  data: T[];
  /** Definição das colunas */
  columns: DataTableColumn<T>[];
  /** Ações disponíveis por linha */
  actions?: DataTableAction<T>[];
  /** Função para obter key única de cada item */
  keyExtractor: (item: T) => string;
  /** Titulo da tabela (opcional) */
  title?: string;
  /** Número de itens por página */
  itemsPerPage?: number;
  /** Mostrar paginação? */
  pagination?: boolean;
  /** Estado vazio customizado */
  emptyState?: React.ReactNode;
  /** Callback quando ordenação muda */
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  /** Estado de loading (mostra skeleton) */
  isLoading?: boolean;
  /** Número de linhas skeleton a exibir durante loading */
  skeletonRows?: number;
  testID?: string;
}

// ============================================
// SKELETON LOADING COMPONENT (Memoized)
// ============================================

const SkeletonLoader = memo(function SkeletonLoader() {
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerValue]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeletonBox,
        { opacity },
      ]}
    />
  );
});

// ============================================
// COMPONENT
// ============================================

function DataTableInner<T = any>({
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
  const { theme } = useUnistyles();

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);

  // Memoized: cálculos de paginação
  const { totalPages, startIndex, endIndex, paginatedData } = useMemo(() => {
    const total = Math.ceil(data.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginated = pagination ? data.slice(start, end) : data;
    return { totalPages: total, startIndex: start, endIndex: end, paginatedData: paginated };
  }, [data, itemsPerPage, currentPage, pagination]);

  // Memoized: colunas filtradas para mobile
  const mobileColumns = useMemo(() => {
    return columns.filter(col => !col.desktopOnly);
  }, [columns]);

  // Ordenação
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Reset page when data changes significantly
  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  // Memoized handlers
  const handleSort = useCallback((columnKey: string) => {
    setSortColumn(prev => {
      const newDirection = prev === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      onSort?.(columnKey, newDirection);
      return columnKey;
    });
  }, [sortDirection, onSort]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage(prev => prev > 1 ? prev - 1 : prev);
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => prev < totalPages ? prev + 1 : prev);
  }, [totalPages]);

  // ============================================
  // LOADING STATE (Skeleton)
  // ============================================
  if (isLoading) {
    // Mobile Skeleton
    if (isMobile || isTablet) {
      return (
        <View style={styles.container} testID={testID}>
          {title && <Text style={styles.title}>{title}</Text>}
          <ScrollView style={styles.mobileContainer}>
            {Array.from({ length: skeletonRows }).map((_, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.cardRow}>
                  <SkeletonLoader />
                </View>
                <View style={styles.cardRow}>
                  <SkeletonLoader />
                </View>
                <View style={styles.cardRow}>
                  <SkeletonLoader />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Desktop Skeleton
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
                  { width: (column.width || 'auto') as DimensionValue, minWidth: 100 },
                ]}
              >
                <Text style={styles.tableHeaderText}>{column.label}</Text>
              </View>
            ))}
            {actions && actions.length > 0 && (
              <View style={[styles.tableHeaderCell, { width: actions.length * 100, minWidth: 180 }]}>
                <Text style={styles.tableHeaderText}>Ações</Text>
              </View>
            )}
          </View>

          {/* Skeleton Rows */}
          {Array.from({ length: skeletonRows }).map((_, index) => (
            <View
              key={index}
              style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}
            >
              {columns.map((column) => (
                <View
                  key={column.key}
                  style={[
                    styles.tableCell,
                    { width: (column.width || 'auto') as DimensionValue, minWidth: 100 },
                  ]}
                >
                  <SkeletonLoader />
                </View>
              ))}
              {actions && actions.length > 0 && (
                <View style={[styles.tableCell, { width: actions.length * 100, minWidth: 180 }]}>
                  <SkeletonLoader />
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ============================================
  // EMPTY STATE
  // ============================================
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

  // ============================================
  // MOBILE VIEW (Cards)
  // ============================================
  if (isMobile || isTablet) {
    return (
      <View style={styles.container} testID={testID}>
        {title && <Text style={styles.title}>{title}</Text>}

        <ScrollView style={styles.mobileContainer}>
          {paginatedData.map((item) => (
            <View key={keyExtractor(item)} style={styles.card}>
              {/* Dados do card */}
              {mobileColumns.map((column) => {
                  const renderedContent = column.render ? column.render(item) : (item as any)[column.key];
                  const isReactElement = typeof renderedContent === 'object' && renderedContent !== null && typeof renderedContent !== 'string';

                  return (
                    <View key={column.key} style={styles.cardRow}>
                      <Text style={styles.cardLabel}>{column.label}:</Text>
                      {isReactElement ? (
                        renderedContent
                      ) : (
                        <Text style={styles.cardValue}>
                          {renderedContent}
                        </Text>
                      )}
                    </View>
                  );
                })}

              {/* Ações */}
              {actions && actions.length > 0 && (
                <View style={styles.cardActions}>
                  {actions.map((action, idx) => {
                    const label = typeof action.label === 'function' ? action.label(item) : action.label;
                    const icon = action.icon ? (typeof action.icon === 'function' ? action.icon(item) : action.icon) : undefined;

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.cardActionButton,
                          action.type === 'danger' && styles.cardActionButtonDanger,
                          action.type === 'secondary' && styles.cardActionButtonSecondary,
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
                            action.type === 'secondary' && styles.cardActionTextSecondary,
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

        {/* Paginação Mobile */}
        {pagination && totalPages > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
              onPress={handlePreviousPage}
              disabled={currentPage === 1}
            >
              <Text style={styles.pageButtonText}>← Anterior</Text>
            </TouchableOpacity>

            <Text style={styles.pageInfo}>
              Página {currentPage} de {totalPages}
            </Text>

            <TouchableOpacity
              style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
              onPress={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <Text style={styles.pageButtonText}>Próxima →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ============================================
  // DESKTOP VIEW (Table)
  // ============================================
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
                    { width: (column.width || 'auto') as DimensionValue, minWidth: 100 },
                    column.align === 'center' && { alignItems: 'center' },
                    column.align === 'right' && { alignItems: 'flex-end' },
                  ]}
                  onPress={() => column.sortable && handleSort(column.key)}
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
                <View style={[styles.tableHeaderCell, { width: actions.length * 100, minWidth: 180 }]}>
                  <Text style={styles.tableHeaderText}>Ações</Text>
                </View>
              )}
            </View>

            {/* Table Body */}
            {paginatedData.map((item, index) => (
              <View
                key={keyExtractor(item)}
                style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}
              >
                {columns.map((column) => (
                  <View
                    key={column.key}
                    style={[
                      styles.tableCell,
                      { width: (column.width || 'auto') as DimensionValue, minWidth: 100 },
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
                        {(item as any)[column.key]}
                      </Text>
                    )}
                  </View>
                ))}

                {/* Ações Desktop */}
                {actions && actions.length > 0 && (
                  <View style={[styles.tableCell, styles.tableCellActions]}>
                    {actions.map((action, idx) => {
                      const label = typeof action.label === 'function' ? action.label(item) : action.label;
                      const icon = action.icon ? (typeof action.icon === 'function' ? action.icon(item) : action.icon) : undefined;

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.tableActionButton,
                            action.type === 'danger' && styles.tableActionButtonDanger,
                            action.type === 'secondary' && styles.tableActionButtonSecondary,
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
                              action.type === 'danger' && styles.tableActionTextDanger,
                              action.type === 'secondary' && styles.tableActionTextSecondary,
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

        {/* Paginação Desktop */}
        {pagination && totalPages > 1 && (
          <View style={styles.paginationDesktop}>
            <Text style={styles.pageInfoDesktop}>
              Mostrando {startIndex + 1} - {Math.min(endIndex, data.length)} de {data.length}{' '}
              registros
            </Text>

            <View style={styles.paginationControls}>
              <TouchableOpacity
                style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                onPress={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <Text style={styles.pageButtonText}>← Anterior</Text>
              </TouchableOpacity>

              <Text style={styles.pageInfo}>
                Página {currentPage} de {totalPages}
              </Text>

              <TouchableOpacity
                style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
                onPress={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <Text style={styles.pageButtonText}>Próxima →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// Export memoized component
// memo prevents re-renders when props haven't changed
export const DataTable = memo(DataTableInner) as typeof DataTableInner;

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  emptyState: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  emptyText: {
    color: theme.colors.gray500,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
  },

  // ============================================
  // MOBILE STYLES (Cards)
  // ============================================
  mobileContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  cardLabel: {
    fontSize: theme.components.table.rowFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    flex: 1,
  },
  cardValue: {
    fontSize: theme.components.table.rowFontSize,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    flex: 2,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  cardActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
    gap: 4,
  },
  cardActionButtonDanger: {
    backgroundColor: `${theme.colors.error}20`,
  },
  cardActionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  cardActionText: {
    fontSize: theme.components.table.actionButtonFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  cardActionTextDanger: {
    color: theme.colors.error,
  },
  cardActionTextSecondary: {
    color: theme.colors.gray600,
  },

  // ============================================
  // DESKTOP STYLES (Table)
  // ============================================
  tableContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.gray50,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.gray200,
  },
  tableHeaderCell: {
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: theme.components.table.headerFontSize,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray700,
  },
  sortIndicator: {
    fontSize: theme.components.table.headerFontSize - 2,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.primary,
    marginLeft: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    // Web-only hover state
    ...(Platform.OS === 'web' && ({
      cursor: 'default',
      transitionProperty: 'background-color',
      transitionDuration: '0.15s',
      transitionTimingFunction: 'ease-in-out',
      ':hover': {
        backgroundColor: theme.colors.primary + '08', // 8% opacity
      },
    } as any)),
  },
  tableRowEven: {
    backgroundColor: theme.colors.gray50,
  },
  tableCell: {
    padding: theme.spacing.sm,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: theme.components.table.rowFontSize,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
  },
  tableCellTextNoWrap: {
    ...(Platform.OS === 'web'
      ? {
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }
      : {}),
  },
  tableCellActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  tableActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
    gap: 4,
    // Web-only hover state
    ...(Platform.OS === 'web' && ({
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'ease-in-out',
      ':hover': {
        backgroundColor: theme.colors.primary + '15', // 15% opacity
        transform: 'translateY(-1px)',
        boxShadow: boxShadow(0, 2, 4, 0, theme.colors.black, 0.1),
      },
    } as any)),
  },
  tableActionButtonDanger: {
    backgroundColor: `${theme.colors.error}20`,
  },
  tableActionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  tableActionText: {
    fontSize: theme.components.table.actionButtonFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  tableActionTextDanger: {
    color: theme.colors.error,
  },
  tableActionTextSecondary: {
    color: theme.colors.gray600,
  },

  // ============================================
  // PAGINATION
  // ============================================
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginTop: theme.spacing.sm,
  },
  paginationDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  pageButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  pageButtonDisabled: {
    backgroundColor: theme.colors.gray300,
    opacity: 0.5,
  },
  pageButtonText: {
    color: theme.colors.background,
    fontSize: theme.components.table.paginationFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  pageInfo: {
    fontSize: theme.components.table.paginationFontSize,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
  },
  pageInfoDesktop: {
    fontSize: theme.components.table.paginationFontSize,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },

  // ============================================
  // SKELETON LOADING
  // ============================================
  skeletonBox: {
    height: 16,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.xs,
    flex: 1,
  },
}));
