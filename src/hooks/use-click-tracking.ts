import { useEffect, useRef, useCallback } from 'react';

interface ClickData {
  element: string;
  type: string;
  x: number;
  y: number;
  time_ms: number;
  text?: string;
}

interface ClickTrackingState {
  clicks: ClickData[];
  pageLoadTime: number;
  firstClickMs: number | null;
}

/**
 * Hook to track element clicks for heatmap analysis
 * Captures click positions, element types, and timing
 */
export function useClickTracking(trackingEnabled: boolean = true) {
  const stateRef = useRef<ClickTrackingState>({
    clicks: [],
    pageLoadTime: Date.now(),
    firstClickMs: null,
  });

  // Get element identifier (prefer id, then data-track, then tag+class)
  const getElementIdentifier = useCallback((element: HTMLElement): string => {
    if (element.id) return `#${element.id}`;
    if (element.dataset.track) return element.dataset.track;
    
    const tag = element.tagName.toLowerCase();
    const classes = element.className?.split?.(' ')?.slice(0, 2)?.join('.') || '';
    return classes ? `${tag}.${classes}` : tag;
  }, []);

  // Get element type
  const getElementType = useCallback((element: HTMLElement): string => {
    const tag = element.tagName.toLowerCase();
    if (tag === 'button' || element.getAttribute('role') === 'button') return 'button';
    if (tag === 'a') return 'link';
    if (tag === 'img') return 'image';
    if (tag === 'input') return 'input';
    if (tag === 'select') return 'select';
    if (element.getAttribute('role') === 'tab') return 'tab';
    if (element.getAttribute('role') === 'menuitem') return 'menu-item';
    return tag;
  }, []);

  // Get truncated text content
  const getElementText = useCallback((element: HTMLElement): string | undefined => {
    const text = element.textContent?.trim() || element.getAttribute('aria-label');
    if (!text) return undefined;
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }, []);

  useEffect(() => {
    if (!trackingEnabled) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      // Find the nearest trackable element (walk up the DOM)
      let trackableElement = target;
      let depth = 0;
      while (trackableElement && depth < 5) {
        const tag = trackableElement.tagName?.toLowerCase();
        if (['button', 'a', 'input', 'select', 'img'].includes(tag) ||
            trackableElement.getAttribute('role') === 'button' ||
            trackableElement.id ||
            trackableElement.dataset.track) {
          break;
        }
        trackableElement = trackableElement.parentElement as HTMLElement;
        depth++;
      }

      if (!trackableElement) return;

      const timeMs = Date.now() - stateRef.current.pageLoadTime;
      
      // Set first click time
      if (stateRef.current.firstClickMs === null) {
        stateRef.current.firstClickMs = timeMs;
      }

      const clickData: ClickData = {
        element: getElementIdentifier(trackableElement),
        type: getElementType(trackableElement),
        x: Math.round(event.pageX),
        y: Math.round(event.pageY),
        time_ms: timeMs,
        text: getElementText(trackableElement),
      };

      stateRef.current.clicks.push(clickData);

      // Keep only last 50 clicks to prevent memory issues
      if (stateRef.current.clicks.length > 50) {
        stateRef.current.clicks = stateRef.current.clicks.slice(-50);
      }
    };

    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, [trackingEnabled, getElementIdentifier, getElementType, getElementText]);

  // Reset tracking for new page/listing
  const resetTracking = useCallback(() => {
    stateRef.current = {
      clicks: [],
      pageLoadTime: Date.now(),
      firstClickMs: null,
    };
  }, []);

  // Get click data for storage
  const getClickData = useCallback(() => {
    const { clicks, firstClickMs } = stateRef.current;
    
    if (clicks.length === 0) return null;

    return {
      clicks,
      total_clicks: clicks.length,
      first_click_ms: firstClickMs,
    };
  }, []);

  return {
    resetTracking,
    getClickData,
    getClickCount: () => stateRef.current.clicks.length,
    getFirstClickTime: () => stateRef.current.firstClickMs,
  };
}
