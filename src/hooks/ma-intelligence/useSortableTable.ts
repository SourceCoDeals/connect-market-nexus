import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T extends string> {
  column: T;
  direction: SortDirection;
}

export interface UseSortableTableOptions<T extends string> {
  defaultColumn: T;
  defaultDirection?: SortDirection;
}

export interface UseSortableTableResult<T extends string, D> {
  sortColumn: T;
  sortDirection: SortDirection;
  sortedData: D[];
  handleSort: (column: T) => void;
  setSortColumn: (column: T) => void;
  setSortDirection: (direction: SortDirection) => void;
}

type SortValueGetter<D, T extends string> = (item: D, column: T) => string | number | Date | null | undefined;

export function useSortableTable<T extends string, D>(
  data: D[],
  getSortValue: SortValueGetter<D, T>,
  options: UseSortableTableOptions<T>
): UseSortableTableResult<T, D> {
  const [sortColumn, setSortColumn] = useState<T>(options.defaultColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(options.defaultDirection ?? 'asc');

  const handleSort = useCallback((column: T) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = getSortValue(a, sortColumn);
      const bVal = getSortValue(b, sortColumn);

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

      // Compare based on type
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else {
        comparison = Number(aVal) - Number(bVal);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection, getSortValue]);

  return {
    sortColumn,
    sortDirection,
    sortedData,
    handleSort,
    setSortColumn,
    setSortDirection,
  };
}
