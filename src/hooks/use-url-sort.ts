import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Persists sort column + direction in the URL so navigating away and
 * pressing Back restores the exact same sort.
 *
 * Usage:
 *   const { sortColumn, sortDirection, handleSort } = useUrlSort("score", "desc");
 */
export function useUrlSort<T extends string>(
  defaultColumn: T,
  defaultDirection: "asc" | "desc" = "asc"
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const sortColumn = (searchParams.get("sort") as T) ?? defaultColumn;
  const sortDirection = (searchParams.get("dir") as "asc" | "desc") ?? defaultDirection;

  const handleSort = useCallback(
    (column: T) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (next.get("sort") === column) {
            next.set("dir", next.get("dir") === "asc" ? "desc" : "asc");
          } else {
            next.set("sort", column);
            next.set("dir", "asc");
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { sortColumn, sortDirection, handleSort };
}
