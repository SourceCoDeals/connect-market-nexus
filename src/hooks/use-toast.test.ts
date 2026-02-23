import { describe, it, expect } from 'vitest';
import { reducer } from './use-toast';

describe('toast reducer', () => {
  const initialState = { toasts: [] as any[] };

  it('adds a toast with ADD_TOAST action', () => {
    const toast = { id: '1', title: 'Test', open: true };
    const newState = reducer(initialState, {
      type: 'ADD_TOAST',
      toast: toast as any,
    });
    expect(newState.toasts).toHaveLength(1);
    expect(newState.toasts[0].id).toBe('1');
    expect(newState.toasts[0].title).toBe('Test');
  });

  it('limits toast count to TOAST_LIMIT', () => {
    let state = initialState;
    // Add multiple toasts (limit is 1)
    for (let i = 0; i < 5; i++) {
      state = reducer(state, {
        type: 'ADD_TOAST',
        toast: { id: String(i), title: `Toast ${i}`, open: true } as any,
      });
    }
    // Should be limited to 1
    expect(state.toasts.length).toBeLessThanOrEqual(1);
  });

  it('updates an existing toast with UPDATE_TOAST', () => {
    const state = {
      toasts: [{ id: '1', title: 'Original', open: true }] as any[],
    };
    const newState = reducer(state, {
      type: 'UPDATE_TOAST',
      toast: { id: '1', title: 'Updated' },
    });
    expect(newState.toasts[0].title).toBe('Updated');
  });

  it('does not update non-matching toast', () => {
    const state = {
      toasts: [{ id: '1', title: 'Original', open: true }] as any[],
    };
    const newState = reducer(state, {
      type: 'UPDATE_TOAST',
      toast: { id: '999', title: 'Updated' },
    });
    expect(newState.toasts[0].title).toBe('Original');
  });

  it('dismisses a specific toast with DISMISS_TOAST', () => {
    const state = {
      toasts: [
        { id: '1', title: 'Toast 1', open: true },
        { id: '2', title: 'Toast 2', open: true },
      ] as any[],
    };
    const newState = reducer(state, {
      type: 'DISMISS_TOAST',
      toastId: '1',
    });
    expect(newState.toasts[0].open).toBe(false);
    expect(newState.toasts[1].open).toBe(true);
  });

  it('dismisses all toasts when no toastId provided', () => {
    const state = {
      toasts: [
        { id: '1', title: 'Toast 1', open: true },
        { id: '2', title: 'Toast 2', open: true },
      ] as any[],
    };
    const newState = reducer(state, {
      type: 'DISMISS_TOAST',
    });
    expect(newState.toasts.every((t: any) => t.open === false)).toBe(true);
  });

  it('removes a specific toast with REMOVE_TOAST', () => {
    const state = {
      toasts: [
        { id: '1', title: 'Toast 1', open: true },
        { id: '2', title: 'Toast 2', open: true },
      ] as any[],
    };
    const newState = reducer(state, {
      type: 'REMOVE_TOAST',
      toastId: '1',
    });
    expect(newState.toasts).toHaveLength(1);
    expect(newState.toasts[0].id).toBe('2');
  });

  it('removes all toasts when no toastId provided to REMOVE_TOAST', () => {
    const state = {
      toasts: [
        { id: '1', title: 'Toast 1', open: true },
        { id: '2', title: 'Toast 2', open: true },
      ] as any[],
    };
    const newState = reducer(state, {
      type: 'REMOVE_TOAST',
    });
    expect(newState.toasts).toHaveLength(0);
  });
});
