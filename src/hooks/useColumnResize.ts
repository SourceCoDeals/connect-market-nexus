import { useState, useCallback, useRef } from "react";

const DEFAULT_MIN_WIDTH = 40;

interface UseColumnResizeOptions {
  /** Default column widths keyed by column name */
  defaultWidths: Record<string, number>;
  /** Minimum width allowed for any column (default: 40) */
  minWidth?: number;
}

interface UseColumnResizeReturn {
  /** Current column widths */
  columnWidths: Record<string, number>;
  /** Get the width for a specific column */
  getWidth: (column: string) => number;
  /** Start resizing a column — attach to onMouseDown on the resize handle */
  startResize: (column: string, e: React.MouseEvent) => void;
}

/**
 * Reusable hook for drag-to-resize table columns.
 *
 * Usage:
 * ```tsx
 * const { columnWidths, startResize } = useColumnResize({
 *   defaultWidths: { name: 200, email: 250, status: 120 },
 * });
 *
 * <TableHead style={{ width: columnWidths.name }} className="relative">
 *   Name
 *   <ResizeHandle onMouseDown={(e) => startResize('name', e)} />
 * </TableHead>
 * ```
 */
export function useColumnResize({
  defaultWidths,
  minWidth = DEFAULT_MIN_WIDTH,
}: UseColumnResizeOptions): UseColumnResizeReturn {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(defaultWidths);
  const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

  const getWidth = useCallback(
    (column: string) => columnWidths[column] ?? defaultWidths[column] ?? 100,
    [columnWidths, defaultWidths],
  );

  const startResize = useCallback(
    (column: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      resizingRef.current = {
        column,
        startX: e.clientX,
        startWidth: columnWidths[column] ?? defaultWidths[column] ?? 100,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = moveEvent.clientX - resizingRef.current.startX;
        const newWidth = Math.max(minWidth, resizingRef.current.startWidth + delta);
        setColumnWidths((prev) => ({
          ...prev,
          [resizingRef.current!.column]: newWidth,
        }));
      };

      const handleMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [columnWidths, defaultWidths, minWidth],
  );

  return { columnWidths, getWidth, startResize };
}
