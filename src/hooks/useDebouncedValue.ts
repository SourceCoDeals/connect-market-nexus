import { useState, useEffect, useRef } from "react";

/**
 * useDebouncedValue - Returns a debounced version of the provided value.
 * The debounced value only updates after `delay` ms have elapsed since the
 * last change to the input value. Useful for search inputs to avoid
 * triggering queries on every keystroke.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @returns The debounced value
 *
 * Usage:
 * ```tsx
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebouncedValue(search, 300);
 *
 * // Use debouncedSearch for API calls
 * useQuery({
 *   queryKey: ['search', debouncedSearch],
 *   queryFn: () => searchApi(debouncedSearch),
 *   enabled: debouncedSearch.length > 0,
 * });
 * ```
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback - Returns a debounced version of a callback function.
 * The callback only fires after `delay` ms have elapsed since the last invocation.
 *
 * @param callback - The callback to debounce
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @returns The debounced callback and a cancel function
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay = 300
): { debouncedFn: (...args: Parameters<T>) => void; cancel: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const cancel = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const debouncedFn = (...args: Parameters<T>) => {
    cancel();
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  };

  return { debouncedFn, cancel };
}
