/**
 * useConnectionRequestsFilters.ts
 *
 * Filter, sort, selection, and bulk-action logic for the ConnectionRequestsTable.
 */
import { useState, useCallback } from "react";
import { AdminConnectionRequest } from "@/types/admin";
import { useUpdateConnectionRequestStatus } from "@/hooks/admin/use-connection-request-status";
import { useToast } from "@/hooks/use-toast";

export function useConnectionRequestsFilters(
  requests: AdminConnectionRequest[],
  selectedSources: string[],
) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  const [bulkRejectNote, setBulkRejectNote] = useState("");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const updateStatus = useUpdateConnectionRequestStatus();
  const { toast } = useToast();

  // Filter requests by selected sources, then by flagged status
  const sourceFilteredRequests =
    selectedSources.length > 0
      ? requests.filter((req) => selectedSources.includes(req.source || "marketplace"))
      : requests;

  const filteredRequests = showFlaggedOnly
    ? sourceFilteredRequests.filter((req) => req.flagged_for_review)
    : sourceFilteredRequests;

  const flaggedCount = requests.filter((req) => req.flagged_for_review).length;

  const toggleExpanded = useCallback(
    (requestId: string) => {
      const newExpanded = new Set(expandedRows);
      if (newExpanded.has(requestId)) {
        newExpanded.delete(requestId);
      } else {
        newExpanded.add(requestId);
      }
      setExpandedRows(newExpanded);
    },
    [expandedRows],
  );

  const toggleSelection = useCallback(
    (requestId: string, checked: boolean) => {
      const next = new Set(selectedIds);
      if (checked) {
        next.add(requestId);
      } else {
        next.delete(requestId);
      }
      setSelectedIds(next);
    },
    [selectedIds],
  );

  const selectAll = useCallback(() => {
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
    }
  }, [selectedIds.size, filteredRequests]);

  const handleBulkAction = useCallback(
    async (status: "approved" | "rejected", notes?: string) => {
      const ids = Array.from(selectedIds);
      let successCount = 0;
      let errorCount = 0;

      for (const id of ids) {
        try {
          await updateStatus.mutateAsync({ requestId: id, status, notes });
          successCount++;
        } catch {
          errorCount++;
        }
      }

      setSelectedIds(new Set());
      setShowBulkRejectDialog(false);
      setBulkRejectNote("");

      const label = status === "approved" ? "approved" : "rejected";
      toast({
        title: `Bulk ${label}`,
        description: `${successCount} request${successCount !== 1 ? "s" : ""} ${label}${errorCount > 0 ? `, ${errorCount} failed` : ""}.`,
      });
    },
    [selectedIds, updateStatus, toast],
  );

  const allSelected =
    selectedIds.size === filteredRequests.length && filteredRequests.length > 0;
  const someSelected = selectedIds.size > 0;

  return {
    // Expansion
    expandedRows,
    toggleExpanded,
    // Selection
    selectedIds,
    toggleSelection,
    selectAll,
    allSelected,
    someSelected,
    setSelectedIds,
    // Filtering
    filteredRequests,
    flaggedCount,
    showFlaggedOnly,
    setShowFlaggedOnly,
    // Bulk actions
    showBulkRejectDialog,
    setShowBulkRejectDialog,
    bulkRejectNote,
    setBulkRejectNote,
    handleBulkAction,
    updateStatusIsPending: updateStatus.isPending,
  };
}
