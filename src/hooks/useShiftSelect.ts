import { useCallback, useRef } from 'react';

/**
 * Excel-like shift-click multi-select hook.
 *
 * Usage:
 *   const { handleToggle } = useShiftSelect(orderedIds, selectedIds, setSelectedIds);
 *   <Checkbox onCheckedChange={(checked) => handleToggle(id, !!checked, event)} />
 *
 * When shift is held during a click, all items between the last-clicked item
 * and the current item will be selected (or deselected, matching the action).
 */
export function useShiftSelect(
  /** Ordered list of IDs currently visible (e.g. the paginated rows) */
  orderedIds: string[],
  /** Current selection set */
  _selectedIds: Set<string>,
  /** Setter for the selection set */
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  const lastClickedRef = useRef<string | null>(null);

  const handleToggle = useCallback(
    (id: string, checked: boolean, event?: React.MouseEvent | React.KeyboardEvent) => {
      const shiftKey = event && 'shiftKey' in event ? event.shiftKey : false;

      if (shiftKey && lastClickedRef.current) {
        const lastIdx = orderedIds.indexOf(lastClickedRef.current);
        const currentIdx = orderedIds.indexOf(id);

        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          const rangeIds = orderedIds.slice(start, end + 1);

          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const rangeId of rangeIds) {
              if (checked) next.add(rangeId);
              else next.delete(rangeId);
            }
            return next;
          });
          lastClickedRef.current = id;
          return;
        }
      }

      // Normal single toggle
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
      lastClickedRef.current = id;
    },
    [orderedIds, setSelectedIds],
  );

  return { handleToggle };
}
