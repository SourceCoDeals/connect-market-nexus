import { useState, useEffect, useRef, useMemo, useCallback } from "react";

interface UseVirtualListOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Height of each item in pixels */
  itemHeight: number;
  /** Number of items to render above and below the visible area */
  overscan?: number;
  /** Height of the container in pixels. If not provided, measured from the container ref. */
  containerHeight?: number;
}

interface VirtualItem {
  /** Index of the item in the full list */
  index: number;
  /** Top offset position in pixels */
  offsetTop: number;
  /** Height of the item in pixels */
  height: number;
}

interface UseVirtualListReturn {
  /** Ref to attach to the scrollable container element */
  containerRef: React.RefObject<HTMLDivElement>;
  /** The virtual items to render (only visible + overscan items) */
  virtualItems: VirtualItem[];
  /** Total height of the full list in pixels — use for the inner spacer div */
  totalHeight: number;
  /** Current scroll offset */
  scrollOffset: number;
  /** Programmatically scroll to an item index */
  scrollToIndex: (index: number, align?: "start" | "center" | "end") => void;
}

/**
 * Virtual scrolling hook for long lists.
 * Only renders the visible items (plus overscan), dramatically reducing DOM nodes
 * for lists with hundreds or thousands of items.
 *
 * Usage:
 * ```tsx
 * const { containerRef, virtualItems, totalHeight } = useVirtualList({
 *   itemCount: items.length,
 *   itemHeight: 60,
 *   overscan: 5,
 * });
 *
 * return (
 *   <div ref={containerRef} style={{ height: 400, overflow: 'auto' }}>
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       {virtualItems.map((virtualItem) => (
 *         <div
 *           key={virtualItem.index}
 *           style={{
 *             position: 'absolute',
 *             top: virtualItem.offsetTop,
 *             height: virtualItem.height,
 *             width: '100%',
 *           }}
 *         >
 *           {items[virtualItem.index]}
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 * );
 * ```
 */
export function useVirtualList({
  itemCount,
  itemHeight,
  overscan = 5,
  containerHeight: externalContainerHeight,
}: UseVirtualListOptions): UseVirtualListReturn {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const containerHeight = externalContainerHeight ?? measuredHeight;

  // Measure container height on mount and resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container || externalContainerHeight !== undefined) return;

    const updateHeight = () => {
      setMeasuredHeight(container.clientHeight);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [externalContainerHeight]);

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollOffset(container.scrollTop);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Total height of all items
  const totalHeight = itemCount * itemHeight;

  // Calculate visible range with overscan
  const virtualItems = useMemo(() => {
    if (containerHeight === 0 || itemCount === 0) return [];

    const startIndex = Math.floor(scrollOffset / itemHeight);
    const endIndex = Math.min(
      itemCount - 1,
      Math.floor((scrollOffset + containerHeight) / itemHeight)
    );

    // Apply overscan
    const overscanStart = Math.max(0, startIndex - overscan);
    const overscanEnd = Math.min(itemCount - 1, endIndex + overscan);

    const items: VirtualItem[] = [];
    for (let i = overscanStart; i <= overscanEnd; i++) {
      items.push({
        index: i,
        offsetTop: i * itemHeight,
        height: itemHeight,
      });
    }

    return items;
  }, [scrollOffset, containerHeight, itemCount, itemHeight, overscan]);

  // Scroll to a specific index
  const scrollToIndex = useCallback(
    (index: number, align: "start" | "center" | "end" = "start") => {
      const container = containerRef.current;
      if (!container) return;

      let targetOffset: number;

      switch (align) {
        case "center":
          targetOffset = index * itemHeight - containerHeight / 2 + itemHeight / 2;
          break;
        case "end":
          targetOffset = index * itemHeight - containerHeight + itemHeight;
          break;
        case "start":
        default:
          targetOffset = index * itemHeight;
          break;
      }

      container.scrollTop = Math.max(0, Math.min(targetOffset, totalHeight - containerHeight));
    },
    [itemHeight, containerHeight, totalHeight]
  );

  return {
    containerRef,
    virtualItems,
    totalHeight,
    scrollOffset,
    scrollToIndex,
  };
}
