import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { useSearchParamState } from './use-search-param-state';

const wrapperWith =
  (initialEntries: string[]) =>
  ({ children }: { children: React.ReactNode }) =>
    createElement(MemoryRouter, { initialEntries }, children);

describe('useSearchParamState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes from URL search param', () => {
    const { result } = renderHook(() => useSearchParamState('q'), {
      wrapper: wrapperWith(['/?q=hello']),
    });

    expect(result.current[0]).toBe('hello');
  });

  it('initializes to empty string when param is absent', () => {
    const { result } = renderHook(() => useSearchParamState('q'), {
      wrapper: wrapperWith(['/']),
    });

    expect(result.current[0]).toBe('');
  });

  it('local value updates synchronously without waiting for URL flush', () => {
    const { result } = renderHook(() => useSearchParamState('q'), {
      wrapper: wrapperWith(['/']),
    });

    act(() => {
      result.current[1]('a');
    });
    expect(result.current[0]).toBe('a');

    act(() => {
      result.current[1]('ab');
    });
    expect(result.current[0]).toBe('ab');

    act(() => {
      result.current[1]('abc');
    });
    expect(result.current[0]).toBe('abc');
  });

  it('does NOT write to the URL on every keystroke', () => {
    // Read both the hook value and the raw URL from the same router
    const { result } = renderHook(
      () => ({
        state: useSearchParamState('q'),
        params: useSearchParams(),
      }),
      { wrapper: wrapperWith(['/']) },
    );

    act(() => {
      result.current.state[1]('a');
    });
    act(() => {
      result.current.state[1]('ab');
    });
    act(() => {
      result.current.state[1]('abc');
    });

    // Local value is current…
    expect(result.current.state[0]).toBe('abc');
    // …but the URL has not been written yet (still within debounce window)
    expect(result.current.params[0].get('q')).toBeNull();
  });

  it('flushes to the URL after the debounce delay', () => {
    const { result } = renderHook(
      () => ({
        state: useSearchParamState('q', 250),
        params: useSearchParams(),
      }),
      { wrapper: wrapperWith(['/']) },
    );

    act(() => {
      result.current.state[1]('hello');
    });
    expect(result.current.params[0].get('q')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.params[0].get('q')).toBe('hello');
  });

  it('only fires one URL write for rapid keystrokes within the debounce window', () => {
    const { result } = renderHook(
      () => ({
        state: useSearchParamState('q', 250),
        params: useSearchParams(),
      }),
      { wrapper: wrapperWith(['/']) },
    );

    act(() => {
      result.current.state[1]('a');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.state[1]('ab');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.state[1]('abc');
    });

    // Still inside the debounce window since the last keystroke
    expect(result.current.params[0].get('q')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.params[0].get('q')).toBe('abc');
  });

  it('removes the param when value is cleared', () => {
    const { result } = renderHook(
      () => ({
        state: useSearchParamState('q'),
        params: useSearchParams(),
      }),
      { wrapper: wrapperWith(['/?q=hello']) },
    );

    expect(result.current.state[0]).toBe('hello');

    act(() => {
      result.current.state[1]('');
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.params[0].get('q')).toBeNull();
  });

  it('preserves other search params when flushing', () => {
    const { result } = renderHook(
      () => ({
        state: useSearchParamState('q'),
        params: useSearchParams(),
      }),
      { wrapper: wrapperWith(['/?other=foo&status=pending']) },
    );

    act(() => {
      result.current.state[1]('search');
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.params[0].get('q')).toBe('search');
    expect(result.current.params[0].get('other')).toBe('foo');
    expect(result.current.params[0].get('status')).toBe('pending');
  });

  it('syncs URL → local state when the URL changes externally', () => {
    const { result } = renderHook(
      () => ({
        state: useSearchParamState('q'),
        params: useSearchParams(),
      }),
      { wrapper: wrapperWith(['/?q=initial']) },
    );

    expect(result.current.state[0]).toBe('initial');

    // Simulate an external URL change (e.g. browser back/forward)
    act(() => {
      result.current.params[1](new URLSearchParams({ q: 'updated' }));
    });

    expect(result.current.state[0]).toBe('updated');
  });
});
