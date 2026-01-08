/**
 * Pagination component for DataTable
 */

import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { dataTableStyles as styles } from './styles';

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * Mobile pagination controls
 */
export const PaginationMobile = memo(function PaginationMobile({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
}: DataTablePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <View style={styles.pagination}>
      <TouchableOpacity
        style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
        onPress={onPrevious}
        disabled={currentPage === 1}
      >
        <Text style={styles.pageButtonText}>← Anterior</Text>
      </TouchableOpacity>

      <Text style={styles.pageInfo}>
        Página {currentPage} de {totalPages}
      </Text>

      <TouchableOpacity
        style={[
          styles.pageButton,
          currentPage === totalPages && styles.pageButtonDisabled,
        ]}
        onPress={onNext}
        disabled={currentPage === totalPages}
      >
        <Text style={styles.pageButtonText}>Próxima →</Text>
      </TouchableOpacity>
    </View>
  );
});

interface PaginationDesktopProps extends DataTablePaginationProps {
  startIndex: number;
  endIndex: number;
  totalItems: number;
}

/**
 * Desktop pagination with item count
 */
export const PaginationDesktop = memo(function PaginationDesktop({
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  onPrevious,
  onNext,
}: PaginationDesktopProps) {
  if (totalPages <= 1) return null;

  return (
    <View style={styles.paginationDesktop}>
      <Text style={styles.pageInfoDesktop}>
        Mostrando {startIndex + 1} - {Math.min(endIndex, totalItems)} de{' '}
        {totalItems} registros
      </Text>

      <View style={styles.paginationControls}>
        <TouchableOpacity
          style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
          onPress={onPrevious}
          disabled={currentPage === 1}
        >
          <Text style={styles.pageButtonText}>← Anterior</Text>
        </TouchableOpacity>

        <Text style={styles.pageInfo}>
          Página {currentPage} de {totalPages}
        </Text>

        <TouchableOpacity
          style={[
            styles.pageButton,
            currentPage === totalPages && styles.pageButtonDisabled,
          ]}
          onPress={onNext}
          disabled={currentPage === totalPages}
        >
          <Text style={styles.pageButtonText}>Próxima →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
