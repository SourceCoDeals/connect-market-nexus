import { useState, useEffect, useCallback } from "react";
import type { FilterState } from "@/components/filters/filter-definitions";

export interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const STORAGE_KEY_PREFIX = "filter_views_";

export function useSavedViews(pageKey: string, defaultViews: SavedView[] = []) {
  const storageKey = `${STORAGE_KEY_PREFIX}${pageKey}`;

  const [views, setViews] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
    } catch { /* ignored */ }
    return defaultViews;
  });

  // Persist whenever views change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(views));
    } catch { /* ignored */ }
  }, [views, storageKey]);

  const addView = useCallback(
    (view: Omit<SavedView, "id">) => {
      const newView: SavedView = {
        ...view,
        id: crypto.randomUUID(),
      };
      setViews((prev) => [...prev, newView]);
      return newView;
    },
    []
  );

  const removeView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const updateView = useCallback((id: string, updates: Partial<SavedView>) => {
    setViews((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updates } : v))
    );
  }, []);

  return { views, addView, removeView, updateView } as const;
}
