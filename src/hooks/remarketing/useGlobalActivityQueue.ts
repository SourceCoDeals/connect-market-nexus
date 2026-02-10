import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  GlobalActivityQueueItem,
  GlobalActivityOperationType,
  GlobalActivityClassification,
  OPERATION_TYPE_LABELS,
} from "@/types/remarketing";

const QUERY_KEY = ["global-activity-queue"];

// ─── Core Query Hook ────────────────────────────────────────────────

export function useGlobalActivityQueue() {
  const queryClient = useQueryClient();

  // Fetch active + queued + recent completed items
  const { data: allItems = [], ...query } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_activity_queue")
        .select("*, profiles:started_by(full_name, email)")
        .in("status", ["queued", "running", "paused", "completed", "failed", "cancelled"])
        .order("queued_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as GlobalActivityQueueItem[];
    },
    refetchInterval: 5000, // Poll every 5s as backup to realtime
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("global-activity-queue-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "global_activity_queue" },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Derived data
  const runningOp = allItems.find((i) => i.status === "running") || null;
  const queuedOps = allItems
    .filter((i) => i.status === "queued")
    .sort((a, b) => new Date(a.queued_at).getTime() - new Date(b.queued_at).getTime());
  const recentHistory = allItems
    .filter((i) => ["completed", "failed", "cancelled"].includes(i.status))
    .slice(0, 20);
  const pausedOp = allItems.find((i) => i.status === "paused") || null;

  return {
    allItems,
    runningOp,
    pausedOp,
    queuedOps,
    recentHistory,
    isLoading: query.isLoading,
    isMajorRunning: !!runningOp && runningOp.classification === "major",
  };
}

// ─── Gate Check Hook ────────────────────────────────────────────────

export function useGlobalGateCheck() {
  const queryClient = useQueryClient();

  /** Returns the currently running MAJOR operation, or null if clear to proceed. */
  const checkGate = useCallback(async (): Promise<GlobalActivityQueueItem | null> => {
    const { data } = await supabase
      .from("global_activity_queue")
      .select("*, profiles:started_by(full_name, email)")
      .eq("classification", "major")
      .in("status", ["running", "paused"])
      .limit(1);
    if (data && data.length > 0) {
      return data[0] as unknown as GlobalActivityQueueItem;
    }
    return null;
  }, []);

  /**
   * Attempt to start a major operation. If another major op is running,
   * the new one is queued instead and a toast is shown.
   * Returns the created queue item.
   */
  const startOrQueueMajorOp = useCallback(
    async (params: {
      operationType: GlobalActivityOperationType;
      totalItems: number;
      contextJson?: Record<string, unknown>;
      description?: string;
      userId: string;
    }): Promise<{ queued: boolean; item: GlobalActivityQueueItem }> => {
      const blocker = await checkGate();

      if (blocker) {
        // Queue instead
        const { data, error } = await supabase
          .from("global_activity_queue")
          .insert({
            operation_type: params.operationType,
            classification: "major" as const,
            status: "queued" as const,
            total_items: params.totalItems,
            context_json: params.contextJson || {},
            description: params.description || null,
            started_by: params.userId,
          })
          .select("*, profiles:started_by(full_name, email)")
          .single();

        if (error) throw error;

        const blockerName = (blocker.profiles as any)?.full_name || "Someone";
        toast.info(
          `${blockerName} is running ${blocker.description || blocker.operation_type}. Your operation has been queued and will start automatically.`
        );

        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        return { queued: true, item: data as unknown as GlobalActivityQueueItem };
      }

      // Start immediately
      const { data, error } = await supabase
        .from("global_activity_queue")
        .insert({
          operation_type: params.operationType,
          classification: "major" as const,
          status: "running" as const,
          total_items: params.totalItems,
          context_json: params.contextJson || {},
          description: params.description || null,
          started_by: params.userId,
          started_at: new Date().toISOString(),
        })
        .select("*, profiles:started_by(full_name, email)")
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return { queued: false, item: data as unknown as GlobalActivityQueueItem };
    },
    [checkGate, queryClient]
  );

  /** Register a minor operation (no blocking, just visibility). */
  const registerMinorOp = useCallback(
    async (params: {
      operationType: GlobalActivityOperationType;
      totalItems?: number;
      description?: string;
      userId: string;
    }) => {
      const { data, error } = await supabase
        .from("global_activity_queue")
        .insert({
          operation_type: params.operationType,
          classification: "minor" as const,
          status: "running" as const,
          total_items: params.totalItems || 1,
          started_by: params.userId,
          started_at: new Date().toISOString(),
          description: params.description || null,
        })
        .select()
        .single();

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return data as unknown as GlobalActivityQueueItem;
    },
    [queryClient]
  );

  return { checkGate, startOrQueueMajorOp, registerMinorOp };
}

// ─── Mutations ──────────────────────────────────────────────────────

export function useGlobalActivityMutations() {
  const queryClient = useQueryClient();

  /** Update progress (completed_items / failed_items). */
  const updateProgress = useMutation({
    mutationFn: async (params: {
      id: string;
      completedItems?: number;
      failedItems?: number;
      errorEntry?: { itemId: string; error: string };
    }) => {
      const updates: Record<string, unknown> = {};
      if (params.completedItems !== undefined) updates.completed_items = params.completedItems;
      if (params.failedItems !== undefined) updates.failed_items = params.failedItems;

      // Append to error_log if provided
      if (params.errorEntry) {
        // Fetch current, append, update
        const { data: current } = await supabase
          .from("global_activity_queue")
          .select("error_log")
          .eq("id", params.id)
          .single();
        const log = Array.isArray(current?.error_log) ? current.error_log : [];
        log.push({ ...params.errorEntry, timestamp: new Date().toISOString() });
        updates.error_log = log;
      }

      const { error } = await supabase
        .from("global_activity_queue")
        .update(updates)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  /** Mark an operation as completed. */
  const completeOperation = useMutation({
    mutationFn: async (params: { id: string; finalStatus?: "completed" | "failed" | "cancelled" }) => {
      const { error } = await supabase
        .from("global_activity_queue")
        .update({
          status: params.finalStatus || "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  /** Pause a running operation. */
  const pauseOperation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("global_activity_queue")
        .update({ status: "paused" as const })
        .eq("id", id)
        .eq("status", "running");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  /** Resume a paused operation. */
  const resumeOperation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("global_activity_queue")
        .update({ status: "running" as const, started_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "paused");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  /** Cancel a queued or running operation. */
  const cancelOperation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("global_activity_queue")
        .update({ status: "cancelled" as const, completed_at: new Date().toISOString() })
        .eq("id", id)
        .in("status", ["queued", "running", "paused"]);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return { updateProgress, completeOperation, pauseOperation, resumeOperation, cancelOperation };
}
