import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { useResponsive } from '@/hooks/useResponsive';

interface Column {
  key: string;
  label: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, item: any) => React.ReactNode;
}

interface ResponsiveDataDisplayProps {
  columns: Column[];
  data: any[];
  onRowPress?: (item: any) => void;
  emptyMessage?: string;
  keyExtractor?: (item: any) => string;
  showSearch?: boolean;
  searchPlaceholder?: string;
}

/**
 * Componente que renderiza dados como tabela em desktop/tablet
 * e como cards em mobile
 */
export function ResponsiveDataDisplay({
  columns,
  data,
  onRowPress,
  emptyMessage = 'Nenhum dado encontrado',
  keyExtractor = (item) => item.id,
  showSearch = false,
  searchPlaceholder = 'Buscar...',
}: ResponsiveDataDisplayProps) {
  const { theme } = useUnistyles();
  const { isMobile, isTablet } = useResponsive();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  // Filtrar dados baseado na busca
  const filteredData = React.useMemo(() => {
    if (!searchTerm) return data;

    return data.filter(item => {
      return columns.some(col => {
        const value = item[col.key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, columns]);

  // Ordenar dados
  const sortedData = React.useMemo(() => {
    if (!sortColumn) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? aVal - bVal
        : bVal - aVal;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Renderizar como cards para mobile
  const renderCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onRowPress?.(item)}
      activeOpacity={0.7}
    >
      {columns.map((col) => {
        const value = item[col.key];
        const displayValue = col.render ? col.render(value, item) : value;

        return (
          <View key={col.key} style={styles.cardRow}>
            <Text style={styles.cardLabel}>{col.label}:</Text>
            <View style={styles.cardValue}>
              {typeof displayValue === 'string' || typeof displayValue === 'number' ? (
                <Text style={styles.cardValueText}>{displayValue}</Text>
              ) : (
                displayValue
              )}
            </View>
          </View>
        );
      })}
    </TouchableOpacity>
  );

  // Renderizar como tabela para desktop/tablet
  const renderTable = () => (
    <ScrollView horizontal={isTablet} showsHorizontalScrollIndicator={false}>
      <View style={styles.table}>
        {/* Header */}
        <View style={styles.tableHeader}>
          {columns.map((col) => (
            <TouchableOpacity
              key={col.key}
              style={[
                styles.tableHeaderCell,
                { width: col.width || 'auto', flex: col.width ? 0 : 1 }
              ]}
              onPress={() => handleSort(col.key)}
            >
              <Text style={styles.tableHeaderText}>{col.label}</Text>
              {sortColumn === col.key && (
                <Ionicons
                  name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={theme.colors.primary}
                  style={{ marginLeft: 4 }}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Rows */}
        {sortedData.map((item, index) => (
          <TouchableOpacity
            key={keyExtractor(item)}
            style={[
              styles.tableRow,
              index % 2 === 1 && styles.tableRowAlt,
              Platform.OS === 'web' && styles.tableRowHover,
            ]}
            onPress={() => onRowPress?.(item)}
            activeOpacity={0.7}
          >
            {columns.map((col) => {
              const value = item[col.key];
              const displayValue = col.render ? col.render(value, item) : value;

              return (
                <View
                  key={col.key}
                  style={[
                    styles.tableCell,
                    {
                      width: col.width || 'auto',
                      flex: col.width ? 0 : 1,
                      alignItems: col.align || 'left',
                    }
                  ]}
                >
                  {typeof displayValue === 'string' || typeof displayValue === 'number' ? (
                    <Text style={styles.tableCellText}>{displayValue}</Text>
                  ) : (
                    displayValue
                  )}
                </View>
              );
            })}
          </TouchableOpacity>
        ))}

        {/* Empty State */}
        {sortedData.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color={theme.colors.gray400} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={theme.colors.gray500} />
          <Text style={styles.searchInput}>{searchPlaceholder}</Text>
        </View>
      )}

      {/* Data Display */}
      {isMobile ? (
        <FlatList
          data={sortedData}
          renderItem={renderCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.cardList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color={theme.colors.gray400} />
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
          }
        />
      ) : (
        renderTable()
      )}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.gray700,
  },
  // Table Styles
  table: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.gray100,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.gray200,
  },
  tableHeaderCell: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    minWidth: 100,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
    backgroundColor: theme.colors.white,
  },
  tableRowAlt: {
    backgroundColor: theme.colors.gray50,
  },
  tableRowHover: {
    // Web-specific hover effect
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      ':hover': {
        backgroundColor: theme.colors.blue50,
      },
    }),
  },
  tableCell: {
    padding: 12,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 14,
    color: theme.colors.gray900,
  },
  // Card Styles
  cardList: {
    padding: 16,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  cardLabel: {
    fontSize: 12,
    color: theme.colors.gray500,
    fontWeight: '500',
    flex: 1,
  },
  cardValue: {
    flex: 2,
    alignItems: 'flex-end',
  },
  cardValueText: {
    fontSize: 14,
    color: theme.colors.gray900,
    textAlign: 'right',
  },
  // Empty State
  emptyState: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: theme.colors.gray500,
  },
}));