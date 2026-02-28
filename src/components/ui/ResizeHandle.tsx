import * as React from "react";

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * A draggable resize handle for table column headers.
 *
 * Place inside a `<TableHead className="relative">` element.
 * Connect to `useColumnResize().startResize` via onMouseDown.
 */
export const ResizeHandle = ({ onMouseDown }: ResizeHandleProps) => (
  <div
    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-10"
    onMouseDown={onMouseDown}
    onClick={(e) => e.stopPropagation()}
  />
);
