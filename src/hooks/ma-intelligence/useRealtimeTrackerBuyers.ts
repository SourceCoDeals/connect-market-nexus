import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { MABuyer } from "@/lib/ma-intelligence/types";

type BuyerChangeHandler = (nextBuyers: MABuyer[]) => void;

function getBuyerSyncStamp(b: Partial<MABuyer> | null | undefined): string {
  // Prefer server-maintained fields if present.
  // remarketing_buyers rows typically have created_at + data_last_updated.
  return (
    (b as any)?.data_last_updated ||
    (b as any)?.updated_at ||
    (b as any)?.created_at ||
    ""
  );
}

function sortByCreatedAtDesc(a: any, b: any) {
  const at = new Date(a?.created_at || 0).getTime();
  const bt = new Date(b?.created_at || 0).getTime();
  return bt - at;
}

function mergeBuyerById(current: MABuyer[], incoming: any, eventType: string): MABuyer[] {
  const id = incoming?.id as string | undefined;
  if (!id) return current;

  if (eventType === "DELETE") {
    return current.filter((b) => b.id !== id);
  }

  const next = current.filter((b) => b.id !== id);
  next.unshift(incoming as MABuyer);
  next.sort(sortByCreatedAtDesc);
  return next;
}

/**
 * Keeps tracker buyers list fresh while enrichment writes stream in.
 * - Primary: Supabase Realtime postgres_changes
 * - Fallback: polling with exponential backoff
 */
export function useRealtimeTrackerBuyers(params: {
  trackerId: string;
  enabled?: boolean;
  buyers: MABuyer[];
  onChange: BuyerChangeHandler;
  onRefresh: () => Promise<void> | void;
}) {
  const { trackerId, enabled = true, buyers, onChange, onRefresh } = params;

  const buyersRef = useRef<MABuyer[]>(buyers);
  useEffect(() => {
    buyersRef.current = buyers;
  }, [buyers]);

  const lastKnownStamp = useMemo(() => {
    const maxStamp = buyers
      .map((b) => getBuyerSyncStamp(b))
      .filter(Boolean)
      .sort()
      .at(-1);
    return maxStamp || null;
  }, [buyers]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number>(2000);
  const lastSeenStampRef = useRef<string | null>(null);

  // Keep ref in sync with latest computed stamp (for polling diffs)
  useEffect(() => {
    lastSeenStampRef.current = lastKnownStamp;
  }, [lastKnownStamp]);

  useEffect(() => {
    if (!enabled) return;
    if (!trackerId || trackerId === "new") return;

    // Cleanup any previous channel/timeouts
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    pollIntervalRef.current = 2000;

    const channel = supabase
      .channel(`tracker-buyers:${trackerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "remarketing_buyers",
          filter: `industry_tracker_id=eq.${trackerId}`,
        },
        (payload: any) => {
          // Realtime can deliver INSERT for upserts; we dedupe by id.
          const eventType = payload?.eventType as string;
          const row = eventType === "DELETE" ? payload?.old : payload?.new;
          if (!row) return;

          onChange(mergeBuyerById(buyersRef.current, row, eventType));
          pollIntervalRef.current = 2000; // reset backoff when realtime works
          const stamp = getBuyerSyncStamp(row);
          if (stamp) lastSeenStampRef.current = stamp;
        }
      )
      .subscribe((status) => {
        // If realtime fails silently, polling will still keep things fresh.
        // We intentionally don't toast here to avoid noise.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          pollIntervalRef.current = 2000;
        }
      });

    channelRef.current = channel;

    const poll = async () => {
      try {
        // Lightweight incremental check: ask for any row newer than last seen stamp.
        // If schema doesn't support data_last_updated consistently, we fall back to full refresh.
        const lastStamp = lastSeenStampRef.current;

        if (lastStamp) {
          const { data, error } = await supabase
            .from("remarketing_buyers")
            .select("id, data_last_updated, created_at")
            .eq("industry_tracker_id", trackerId)
            .gt("data_last_updated", lastStamp)
            .limit(1);

          if (error) throw error;
          if (data && data.length > 0) {
            await onRefresh();
            pollIntervalRef.current = 2000;
          } else {
            pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, 30000);
          }
        } else {
          // No stamp yet (empty list or no timestamps) → just refresh occasionally.
          await onRefresh();
          pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, 30000);
        }
      } catch {
        pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, 30000);
      } finally {
        pollTimeoutRef.current = window.setTimeout(poll, pollIntervalRef.current);
      }
    };

    pollTimeoutRef.current = window.setTimeout(poll, pollIntervalRef.current);

    return () => {
      if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      pollTimeoutRef.current = null;
    };
    // NOTE: buyers is intentionally excluded from deps; we use onChange to reconcile
    // and polling refresh to keep things correct. Including buyers would resubscribe per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackerId, enabled, onRefresh, onChange]);
}
