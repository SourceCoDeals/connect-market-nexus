import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Local state bound to a URL search param with a debounced write-back.
 *
 * Why not just derive from `useSearchParams()` directly?
 * Writing to `setSearchParams` on every keystroke causes a router navigation
 * on every character typed. That re-renders every component subscribed to
 * `location`, can disrupt input focus, and makes unrelated UI (e.g. sidebar
 * link clicks) feel laggy or unresponsive.
 *
 * This hook keeps the input in React state for instant typing, and flushes
 * the value to the URL on a short debounce. Browser back/forward still works
 * because changes to the URL propagate back into local state.
 *
 * @param key        The search param name (e.g. `'q'`)
 * @param delayMs    Debounce delay for URL writes (default 250ms)
 */
export function useSearchParamState(key: string, delayMs = 250): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlValue = searchParams.get(key) ?? '';
  const [localValue, setLocalValue] = useState(urlValue);

  // Sync URL → local state for back/forward navigation or external param changes
  useEffect(() => {
    setLocalValue((prev) => (prev === urlValue ? prev : urlValue));
  }, [urlValue]);

  // Debounced local → URL sync: typing never writes to the router synchronously
  useEffect(() => {
    if (localValue === urlValue) {
      return undefined;
    }
    const id = window.setTimeout(() => {
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (localValue) n.set(key, localValue);
          else n.delete(key);
          return n;
        },
        { replace: true },
      );
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [localValue, urlValue, key, delayMs, setSearchParams]);

  const setValue = useCallback((v: string) => {
    setLocalValue(v);
  }, []);

  return [localValue, setValue];
}
