/**
 * Performance utilities for the application.
 * Provides debounce, throttle, memoize, and requestIdleCallback helpers.
 */

/**
 * Debounce a function — delays invoking `fn` until `delay` ms have elapsed
 * since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      lastArgs = null;
      fn.apply(this, args);
    }, delay);
  } as T & { cancel: () => void; flush: () => void };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  debounced.flush = () => {
    if (timeoutId !== null && lastArgs !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  };

  return debounced;
}

/**
 * Throttle a function — ensures `fn` is called at most once every `interval` ms.
 * Uses a leading + trailing approach.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  interval: number
): T & { cancel: () => void } {
  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    if (elapsed >= interval) {
      // Leading call
      lastCallTime = now;
      fn.apply(this, args);
    } else {
      // Trailing call — schedule for the end of the interval
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, interval - elapsed);
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttled;
}

/**
 * Memoize an expensive pure function. Caches results based on serialized arguments.
 * Supports an optional `maxSize` to limit the cache (LRU eviction).
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: {
    maxSize?: number;
    keyFn?: (...args: Parameters<T>) => string;
  } = {}
): T & { cache: Map<string, ReturnType<T>>; clear: () => void } {
  const { maxSize = 100, keyFn } = options;
  const cache = new Map<string, ReturnType<T>>();
  const keyOrder: string[] = [];

  const memoized = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      // Move key to end (most recently used)
      const idx = keyOrder.indexOf(key);
      if (idx !== -1) {
        keyOrder.splice(idx, 1);
        keyOrder.push(key);
      }
      return cache.get(key)!;
    }

    const result = fn.apply(this, args) as ReturnType<T>;

    // Evict oldest entry if cache is full
    if (cache.size >= maxSize) {
      const oldestKey = keyOrder.shift();
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, result);
    keyOrder.push(key);

    return result;
  } as T & { cache: Map<string, ReturnType<T>>; clear: () => void };

  memoized.cache = cache;
  memoized.clear = () => {
    cache.clear();
    keyOrder.length = 0;
  };

  return memoized;
}

/**
 * Wrapper around requestIdleCallback with a fallback for browsers that don't support it.
 * Schedules work to be done during idle periods.
 */
export function scheduleIdleWork(
  callback: (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void,
  options?: { timeout?: number }
): number {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    return window.requestIdleCallback(callback, options);
  }

  if (typeof window === "undefined") return 0 as unknown as number;

  // Fallback: use setTimeout with 1ms delay, simulating idle behavior
  const start = Date.now();
  const w = window as unknown as Record<string, unknown>;
  return (w.setTimeout as typeof setTimeout)(() => {
    callback({
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      didTimeout: false,
    });
  }, 1) as unknown as number;
}

/**
 * Cancel a scheduled idle work callback.
 */
export function cancelIdleWork(id: number): void {
  if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Run a list of tasks during idle periods, processing one per idle callback.
 * Useful for non-urgent background work like preloading or analytics.
 */
export function runIdleTasks(
  tasks: Array<() => void>,
  options?: { timeout?: number }
): () => void {
  let cancelled = false;
  let currentId: number | null = null;
  let taskIndex = 0;

  function processNext() {
    if (cancelled || taskIndex >= tasks.length) return;

    currentId = scheduleIdleWork(
      (deadline) => {
        while (taskIndex < tasks.length && (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
          if (cancelled) return;
          tasks[taskIndex]();
          taskIndex++;
        }

        if (taskIndex < tasks.length) {
          processNext();
        }
      },
      options
    );
  }

  processNext();

  // Return a cancel function
  return () => {
    cancelled = true;
    if (currentId !== null) {
      cancelIdleWork(currentId);
    }
  };
}
