import { useRef, useEffect, useCallback, useState } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventDefault?: boolean;
}

interface LongPressOptions {
  onLongPress: () => void;
  threshold?: number;
  cancelOnMove?: boolean;
}

interface HapticFeedbackOptions {
  type?: 'light' | 'medium' | 'heavy';
}

export function useSwipeGesture(options: SwipeGestureOptions) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    preventDefault = false
  } = options;

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (preventDefault) e.preventDefault();
    touchStartX.current = e.changedTouches[0].screenX;
    touchStartY.current = e.changedTouches[0].screenY;
  }, [preventDefault]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (preventDefault) e.preventDefault();
    touchEndX.current = e.changedTouches[0].screenX;
    touchEndY.current = e.changedTouches[0].screenY;
    
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = touchEndY.current - touchStartY.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine swipe direction
    if (absDeltaX > threshold && absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    } else if (absDeltaY > threshold && absDeltaY > absDeltaX) {
      // Vertical swipe
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, preventDefault]);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}

export function useLongPress(options: LongPressOptions) {
  const { onLongPress, threshold = 500, cancelOnMove = true } = options;
  const timeoutRef = useRef<NodeJS.Timeout>();
  const startPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    startPositionRef.current = { x: clientX, y: clientY };
    
    timeoutRef.current = setTimeout(() => {
      onLongPress();
      triggerHaptic({ type: 'medium' });
    }, threshold);
  }, [onLongPress, threshold]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const move = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!cancelOnMove || !timeoutRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = Math.abs(clientX - startPositionRef.current.x);
    const deltaY = Math.abs(clientY - startPositionRef.current.y);
    
    // Cancel if moved more than 10px
    if (deltaX > 10 || deltaY > 10) {
      cancel();
    }
  }, [cancelOnMove, cancel]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: cancel,
    onTouchEnd: cancel,
    onMouseLeave: cancel,
    onTouchMove: move,
    onMouseMove: move,
  };
}

export function triggerHaptic(options: HapticFeedbackOptions = {}) {
  const { type = 'light' } = options;
  
  // Check if the device supports haptic feedback
  if ('vibrate' in navigator) {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([10, 10, 30]);
        break;
    }
  }
}

export function usePullToRefresh(onRefresh: () => void | Promise<void>, threshold: number = 80) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const distance = Math.max(0, currentY.current - startY.current);
    
    // Only trigger if at the top of the page
    if (window.scrollY === 0 && distance > 0) {
      setPullDistance(distance);
      if (distance > threshold) {
        triggerHaptic({ type: 'light' });
      }
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > threshold && !isRefreshing) {
      setIsRefreshing(true);
      triggerHaptic({ type: 'medium' });
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const element = document.body;
    const touchStartHandler = (e: TouchEvent) => handleTouchStart(e as any);
    const touchMoveHandler = (e: TouchEvent) => handleTouchMove(e as any);
    const touchEndHandler = () => handleTouchEnd();
    
    element.addEventListener('touchstart', touchStartHandler, { passive: true });
    element.addEventListener('touchmove', touchMoveHandler, { passive: true });
    element.addEventListener('touchend', touchEndHandler, { passive: true });

    return () => {
      element.removeEventListener('touchstart', touchStartHandler);
      element.removeEventListener('touchmove', touchMoveHandler);
      element.removeEventListener('touchend', touchEndHandler);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isRefreshing,
    pullDistance,
    showRefreshIndicator: pullDistance > threshold,
  };
}