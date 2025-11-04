import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

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
}

export interface DataTableAction<T = any> {
  /** Label da ação */
  label: string;
  /** Ícone (emoji ou texto) */
  icon?: string;
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
}

// ============================================
// SKELETON LOADING COMPONENT
// ============================================

function SkeletonLoader() {
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
}

// ============================================
// COMPONENT
// ============================================

export function DataTable<T = any>({
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
}: DataTableProps<T>) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = pagination ? data.slice(startIndex, endIndex) : data;

  // Ordenação
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handlers
  const handleSort = (columnKey: string) => {
    const newDirection = sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnKey);
    setSortDirection(newDirection);
    onSort?.(columnKey, newDirection);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // ============================================
  // LOADING STATE (Skeleton)
  // ============================================
  if (isLoading) {
    // Mobile Skeleton
    if (isMobile || isTablet) {
      return (
        <View style={styles.container}>
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
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            {columns.map((column) => (
              <View
                key={column.key}
                style={[
                  styles.tableHeaderCell,
                  { width: column.width || 'auto', minWidth: 100 },
                ]}
              >
                <Text style={styles.tableHeaderText}>{column.label}</Text>
              </View>
            ))}
            {actions && actions.length > 0 && (
              <View style={[styles.tableHeaderCell, { width: actions.length * 80 }]}>
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
                    { width: column.width || 'auto', minWidth: 100 },
                  ]}
                >
                  <SkeletonLoader />
                </View>
              ))}
              {actions && actions.length > 0 && (
                <View style={[styles.tableCell, { width: actions.length * 80 }]}>
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
      <View style={styles.container}>
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
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}

        <ScrollView style={styles.mobileContainer}>
          {paginatedData.map((item, index) => (
            <View key={keyExtractor(item)} style={styles.card}>
              {/* Dados do card */}
              {columns
                .filter(col => !col.desktopOnly)
                .map((column) => (
                  <View key={column.key} style={styles.cardRow}>
                    <Text style={styles.cardLabel}>{column.label}:</Text>
                    <Text style={styles.cardValue}>
                      {column.render ? column.render(item) : (item as any)[column.key]}
                    </Text>
                  </View>
                ))}

              {/* Ações */}
              {actions && actions.length > 0 && (
                <View style={styles.cardActions}>
                  {actions.map((action, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.cardActionButton,
                        action.type === 'danger' && styles.cardActionButtonDanger,
                      ]}
                      onPress={() => action.onPress(item)}
                    >
                      {action.icon && <Text style={styles.cardActionIcon}>{action.icon}</Text>}
                      <Text
                        style={[
                          styles.cardActionText,
                          action.type === 'danger' && styles.cardActionTextDanger,
                        ]}
                      >
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
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
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.tableContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              {columns.map((column) => (
                <TouchableOpacity
                  key={column.key}
                  style={[
                    styles.tableHeaderCell,
                    { width: column.width || 'auto', minWidth: 100 },
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
                <View style={[styles.tableHeaderCell, { width: actions.length * 80 }]}>
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
                      { width: column.width || 'auto', minWidth: 100 },
                      column.align === 'center' && { alignItems: 'center' },
                      column.align === 'right' && { alignItems: 'flex-end' },
                    ]}
                  >
                    <Text style={styles.tableCellText}>
                      {column.render ? column.render(item) : (item as any)[column.key]}
                    </Text>
                  </View>
                ))}

                {/* Ações Desktop */}
                {actions && actions.length > 0 && (
                  <View style={[styles.tableCell, styles.tableCellActions]}>
                    {actions.map((action, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.tableActionButton,
                          action.type === 'danger' && styles.tableActionButtonDanger,
                        ]}
                        onPress={() => action.onPress(item)}
                      >
                        {action.icon && <Text>{action.icon}</Text>}
                        <Text
                          style={[
                            styles.tableActionText,
                            action.type === 'danger' && styles.tableActionTextDanger,
                          ]}
                        >
                          {action.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
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

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827', // Gray 900 - Brand Guidelines
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb', // Gray 200
  },
  emptyText: {
    color: '#6b7280', // Gray 500
    fontSize: 16,
  },

  // ============================================
  // MOBILE STYLES (Cards)
  // ============================================
  mobileContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb', // Gray 200
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280', // Gray 500
    flex: 1,
  },
  cardValue: {
    fontSize: 14,
    color: '#111827', // Gray 900
    flex: 2,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cardActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f3f4f6', // Gray 100
    gap: 4,
  },
  cardActionButtonDanger: {
    backgroundColor: '#fee2e2', // Red 100
  },
  cardActionIcon: {
    fontSize: 14,
  },
  cardActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e5aa8', // Azul Main
  },
  cardActionTextDanger: {
    color: '#ef4444', // Red
  },

  // ============================================
  // DESKTOP STYLES (Table)
  // ============================================
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb', // Gray 50
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderCell: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151', // Gray 700
  },
  sortIndicator: {
    fontSize: 12,
    color: '#1e5aa8', // Azul Main
    marginLeft: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRowEven: {
    backgroundColor: '#f9fafb', // Gray 50
  },
  tableCell: {
    padding: 12,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 14,
    color: '#111827', // Gray 900
  },
  tableCellActions: {
    flexDirection: 'row',
    gap: 8,
  },
  tableActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  tableActionButtonDanger: {
    backgroundColor: '#fee2e2',
  },
  tableActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e5aa8', // Azul Main
  },
  tableActionTextDanger: {
    color: '#ef4444',
  },

  // ============================================
  // PAGINATION
  // ============================================
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 12,
  },
  paginationDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pageButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#1e5aa8', // Azul Main
  },
  pageButtonDisabled: {
    backgroundColor: '#d1d5db', // Gray 300
    opacity: 0.5,
  },
  pageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pageInfo: {
    fontSize: 14,
    color: '#6b7280', // Gray 500
    fontWeight: '500',
  },
  pageInfoDesktop: {
    fontSize: 14,
    color: '#6b7280',
  },

  // ============================================
  // SKELETON LOADING
  // ============================================
  skeletonBox: {
    height: 16,
    backgroundColor: '#e5e7eb', // Gray 200
    borderRadius: 4,
    flex: 1,
  },
});
