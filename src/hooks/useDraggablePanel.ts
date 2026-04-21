import { useCallback, useEffect, useRef, useState } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggablePanelOptions {
  storageKey: string;
  panelSize: { width: number; height: number };
  edgeMargin?: number;
}

interface UseDraggablePanelReturn {
  position: Position | null;
  isDragging: boolean;
  handleDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  resetPosition: () => void;
}

function readStoredPosition(storageKey: string): Position | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function clampToViewport(
  pos: Position,
  panelSize: { width: number; height: number },
  edgeMargin: number,
): Position {
  const minVisible = 120;
  const maxX = window.innerWidth - minVisible;
  const maxY = window.innerHeight - minVisible;
  const minX = -(panelSize.width - minVisible);
  const minY = edgeMargin;
  return {
    x: Math.min(maxX, Math.max(minX, pos.x)),
    y: Math.min(maxY, Math.max(minY, pos.y)),
  };
}

export function useDraggablePanel({
  storageKey,
  panelSize,
  edgeMargin = 16,
}: UseDraggablePanelOptions): UseDraggablePanelReturn {
  const [position, setPosition] = useState<Position | null>(() => readStoredPosition(storageKey));
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPanelX: number;
    startPanelY: number;
  } | null>(null);

  useEffect(() => {
    if (!position) return;
    const clamped = clampToViewport(position, panelSize, edgeMargin);
    if (clamped.x !== position.x || clamped.y !== position.y) {
      setPosition(clamped);
    }
  }, [position, panelSize, edgeMargin]);

  useEffect(() => {
    function onResize() {
      setPosition((prev) => (prev ? clampToViewport(prev, panelSize, edgeMargin) : prev));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [panelSize, edgeMargin]);

  const getCurrentPanelTopLeft = useCallback((): Position => {
    if (position) return position;
    return {
      x: window.innerWidth - panelSize.width - edgeMargin * 2,
      y: window.innerHeight - panelSize.height - edgeMargin * 2,
    };
  }, [position, panelSize, edgeMargin]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const isTouch = 'touches' in e;
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;
      const current = getCurrentPanelTopLeft();
      dragStateRef.current = {
        startClientX: clientX,
        startClientY: clientY,
        startPanelX: current.x,
        startPanelY: current.y,
      };
      setIsDragging(true);

      function onMove(ev: MouseEvent | TouchEvent) {
        if (!dragStateRef.current) return;
        const mv = 'touches' in ev ? ev.touches[0] : (ev as MouseEvent);
        const dx = mv.clientX - dragStateRef.current.startClientX;
        const dy = mv.clientY - dragStateRef.current.startClientY;
        const next = clampToViewport(
          {
            x: dragStateRef.current.startPanelX + dx,
            y: dragStateRef.current.startPanelY + dy,
          },
          panelSize,
          edgeMargin,
        );
        setPosition(next);
        if ('touches' in ev && ev.cancelable) ev.preventDefault();
      }

      function onEnd() {
        dragStateRef.current = null;
        setIsDragging(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        setPosition((latest) => {
          if (latest) {
            try {
              localStorage.setItem(storageKey, JSON.stringify(latest));
            } catch {
              /* quota or disabled storage — ignore */
            }
          }
          return latest;
        });
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    },
    [getCurrentPanelTopLeft, panelSize, edgeMargin, storageKey],
  );

  const resetPosition = useCallback(() => {
    setPosition(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { position, isDragging, handleDragStart, resetPosition };
}
