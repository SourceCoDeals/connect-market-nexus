import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { startOfDay, subDays } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────
export type TimeframePreset =
  | "today"
  | "last_7d"
  | "last_14d"
  | "last_30d"
  | "last_90d"
  | "last_365d"
  | "all_time"
  | "custom";

export interface TimeframeValue {
  preset: TimeframePreset;
  from?: Date;
  to?: Date;
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export const TIMEFRAME_PRESETS: {
  key: TimeframePreset;
  label: string;
}[] = [
  { key: "today", label: "Today" },
  { key: "last_7d", label: "Last 7 days" },
  { key: "last_14d", label: "Last 14 days" },
  { key: "last_30d", label: "Last 30 days" },
  { key: "last_90d", label: "Last 90 days" },
  { key: "last_365d", label: "Last year" },
  { key: "all_time", label: "All time" },
  { key: "custom", label: "Custom range" },
];

// ─── Compute date range from a preset ───────────────────────────
function computeRange(value: TimeframeValue): DateRange {
  const now = new Date();
  const todayStart = startOfDay(now);

  switch (value.preset) {
    case "today":
      return { from: todayStart, to: now };
    case "last_7d":
      return { from: startOfDay(subDays(now, 7)), to: now };
    case "last_14d":
      return { from: startOfDay(subDays(now, 14)), to: now };
    case "last_30d":
      return { from: startOfDay(subDays(now, 30)), to: now };
    case "last_90d":
      return { from: startOfDay(subDays(now, 90)), to: now };
    case "last_365d":
      return { from: startOfDay(subDays(now, 365)), to: now };
    case "all_time":
      return { from: null, to: null };
    case "custom":
      return { from: value.from ?? null, to: value.to ?? null };
    default:
      return { from: null, to: null };
  }
}

// ─── URL serialization ──────────────────────────────────────────
function serializeToParams(
  value: TimeframeValue,
  params: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set("tf", value.preset);
  if (value.preset === "custom") {
    if (value.from) next.set("tf_from", value.from.toISOString().slice(0, 10));
    if (value.to) next.set("tf_to", value.to.toISOString().slice(0, 10));
  } else {
    next.delete("tf_from");
    next.delete("tf_to");
  }
  return next;
}

function deserializeFromParams(params: URLSearchParams): TimeframeValue | null {
  const preset = params.get("tf") as TimeframePreset | null;
  if (!preset) return null;
  if (preset === "custom") {
    const fromStr = params.get("tf_from");
    const toStr = params.get("tf_to");
    return {
      preset: "custom",
      from: fromStr ? new Date(fromStr) : undefined,
      to: toStr ? new Date(toStr) : undefined,
    };
  }
  return { preset };
}

// ─── Hook ───────────────────────────────────────────────────────
export function useTimeframe(defaultPreset: TimeframePreset = "last_30d") {
  const [searchParams, setSearchParams] = useSearchParams();

  const initial = useMemo(() => {
    return deserializeFromParams(searchParams) ?? { preset: defaultPreset };
  }, []); // only on mount

  const [timeframe, setTimeframeLocal] = useState<TimeframeValue>(initial);

  const dateRange = useMemo(() => computeRange(timeframe), [timeframe]);

  const setTimeframe = useCallback(
    (next: TimeframeValue) => {
      setTimeframeLocal(next);
      setSearchParams((prev) => serializeToParams(next, prev), {
        replace: true,
      });
    },
    [setSearchParams]
  );

  /** Helper: returns true if a given date is within the active range */
  const isInRange = useCallback(
    (date: Date | string | null | undefined): boolean => {
      if (!date) return false;
      const d = typeof date === "string" ? new Date(date) : date;
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      return true;
    },
    [dateRange]
  );

  return { timeframe, setTimeframe, dateRange, isInRange } as const;
}
