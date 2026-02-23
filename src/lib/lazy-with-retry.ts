import { lazy, type ComponentType } from 'react';

/**
 * Wraps React.lazy with automatic retry on stale chunk failures.
 * When a deploy invalidates cached JS chunks, this triggers a full page reload
 * instead of showing an error screen.
 */
export const lazyWithRetry = (importFn: () => Promise<{ default: ComponentType }>) =>
  lazy(() =>
    importFn().catch((error: Error) => {
      if (
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed')
      ) {
        console.warn('[ChunkRecovery] Stale module detected, reloading...', error.message);
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }),
  );
