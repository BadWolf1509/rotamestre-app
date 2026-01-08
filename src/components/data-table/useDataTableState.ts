/**
 * Hook for DataTable pagination and sorting state management
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

import type { DataTableState } from './types';

interface UseDataTableStateOptions<T> {
  data: T[];
  itemsPerPage: number;
  pagination: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
}

/**
 * Manages pagination and sorting state for DataTable
 */
export function useDataTableState<T>({
  data,
  itemsPerPage,
  pagination,
  onSort,
}: UseDataTableStateOptions<T>): DataTableState<T> {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Memoized pagination calculations
  const { totalPages, startIndex, endIndex, paginatedData } = useMemo(() => {
    const total = Math.ceil(data.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginated = pagination ? data.slice(start, end) : data;
    return {
      totalPages: total,
      startIndex: start,
      endIndex: end,
      paginatedData: paginated,
    };
  }, [data, itemsPerPage, currentPage, pagination]);

  // Reset page when data changes significantly
  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  // Memoized handlers
  const handleSort = useCallback(
    (columnKey: string) => {
      setSortColumn((prev) => {
        const newDirection =
          prev === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
        setSortDirection(newDirection);
        onSort?.(columnKey, newDirection);
        return columnKey;
      });
    },
    [sortDirection, onSort]
  );

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => (prev > 1 ? prev - 1 : prev));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => (prev < totalPages ? prev + 1 : prev));
  }, [totalPages]);

  return {
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
  };
}
