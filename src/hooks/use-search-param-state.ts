import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

type Serializer<T> = (value: T) => string;
type Deserializer<T> = (raw: string) => T;

interface UseSearchParamStateOptions<T> {
  /** Custom serializer (default: String) */
  serialize?: Serializer<T>;
  /** Custom deserializer (default: identity) */
  deserialize?: Deserializer<T>;
}

// ─── Built-in type serializers ────────────────────────────────────────────────

function defaultSerialize<T>(value: T): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  return String(value);
}

function inferDeserialize<T>(defaultValue: T): Deserializer<T> {
  if (typeof defaultValue === 'boolean') {
    return ((raw: string) => raw === '1' || raw === 'true') as unknown as Deserializer<T>;
  }
  if (typeof defaultValue === 'number') {
    return ((raw: string) => {
      const n = Number(raw);
      return isNaN(n) ? defaultValue : n;
    }) as unknown as Deserializer<T>;
  }
  return ((raw: string) => raw) as unknown as Deserializer<T>;
}

/**
 * Drop-in replacement for useState that persists to URL search params.
 *
 * When the user navigates away and presses browser Back, the URL (and thus
 * the state) is restored automatically by the browser history stack.
 *
 * @example
 *   const [search, setSearch] = useSearchParamState('q', '');
 *   const [page, setPage] = useSearchParamState('page', 1);
 *   const [showArchived, setShowArchived] = useSearchParamState('archived', false);
 */
export function useSearchParamState<T extends string | number | boolean>(
  key: string,
  defaultValue: T,
  options?: UseSearchParamStateOptions<T>,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const serialize = options?.serialize ?? defaultSerialize;
  const deserialize = options?.deserialize ?? inferDeserialize(defaultValue);

  // Read current value from URL
  const raw = searchParams.get(key);
  const value: T = raw !== null && raw !== '' ? deserialize(raw) : defaultValue;

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setSearchParams(
        (prev) => {
          const currentRaw = prev.get(key);
          const currentValue: T =
            currentRaw !== null && currentRaw !== '' ? deserialize(currentRaw) : defaultValue;
          const resolved =
            typeof next === 'function' ? (next as (prev: T) => T)(currentValue) : next;
          const params = new URLSearchParams(prev);

          const serialized = serialize(resolved);
          // Remove param if it matches the default (keep URLs clean)
          if (serialized === '' || serialized === defaultSerialize(defaultValue)) {
            params.delete(key);
          } else {
            params.set(key, serialized);
          }

          return params;
        },
        { replace: true },
      );
    },
    [key, defaultValue, serialize, deserialize, setSearchParams],
  );

  return [value, setValue];
}
