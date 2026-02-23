import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy with automatic retry on stale chunk failures.
 * When Vite deploys new code, old chunk URLs break — this detects
 * that and reloads the page once to pick up the new manifest.
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
    })
  );
