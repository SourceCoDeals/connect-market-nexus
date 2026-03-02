/**
 * ConnectionRequestsTable.tsx
 *
 * Sortable, filterable table of buyer connection requests and owner leads. Orchestrates
 * the ConnectionRequestRow cards, filter/sort/bulk-action logic, and toolbar controls.
 *
 * Data sources:
 *   AdminConnectionRequest[] passed via props (from connection_requests table);
 *   useUnreadMessageCounts hook
 *
 * Used on:
 *   Admin requests page (/admin/requests)
 */
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  CheckCircle,
  XCircle,
  RefreshCw,
  MessageSquare,
  Zap,
  Loader2,
  Flag,
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { useUnreadMessageCounts } from "@/hooks/use-connection-messages";
import { SourceFilter } from "./SourceFilter";
import { useToast } from "@/hooks/use-toast";
import { ConnectionRequestRow } from "./ConnectionRequestRow";
import { useConnectionRequestsFilters } from "./useConnectionRequestsFilters";

// ---------- ScoreBuyersButton ----------

const ScoreBuyersButton = ({
  requests,
  onRefresh,
}: {
  requests: AdminConnectionRequest[];
  onRefresh?: () => void;
}) => {
  const [isScoring, setIsScoring] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const { toast } = useToast();

  const handleScore = useCallback(
    async (unscoredOnly: boolean) => {
      const profileIds = [
        ...new Set(
          requests.map((r) => r.user?.id).filter(Boolean) as string[],
        ),
      ];

      const toScore = unscoredOnly
        ? profileIds.filter((id) => {
            const req = requests.find((r) => r.user?.id === id);
            return req && req.user?.buyer_quality_score == null;
          })
        : profileIds;

      if (toScore.length === 0) {
        toast({
          title: "Nothing to score",
          description: unscoredOnly
            ? "All buyers already have scores."
            : "No buyer profiles found.",
        });
        return;
      }

      setIsScoring(true);
      setProgress({ done: 0, total: toScore.length });

      const { queueBuyerQualityScoring } = await import(
        "@/lib/remarketing/queueScoring"
      );
      const result = await queueBuyerQualityScoring(toScore);
      setProgress({ done: toScore.length, total: toScore.length });

      setIsScoring(false);
      toast({
        title: "Scoring complete",
        description: `${result.scored} scored${result.errors > 0 ? `, ${result.errors} failed` : ""}`,
      });
      onRefresh?.();
    },
    [requests, onRefresh, toast],
  );

  if (isScoring) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Scoring {progress.done}/{progress.total}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Zap className="h-4 w-4 mr-2" />
          Score Buyers
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleScore(false)}>Score All</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleScore(true)}>Unscored Only</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// ---------- Skeleton / Empty states ----------

const ConnectionRequestsTableSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Card key={i}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-3 w-[200px]" />
              </div>
            </div>
            <Skeleton className="h-6 w-[80px]" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const ConnectionRequestsTableEmpty = () => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-16">
      <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold text-muted-foreground mb-2">
        No connection requests found
      </h3>
      <p className="text-sm text-muted-foreground">
        Connection requests will appear here when users submit them.
      </p>
    </CardContent>
  </Card>
);

// ---------- BulkRejectDialog ----------

function BulkRejectDialog({
  open,
  onOpenChange,
  count,
  note,
  onNoteChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  note: string;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Reject {count} request{count !== 1 ? "s" : ""}?
          </DialogTitle>
          <DialogDescription className="text-sm">
            All selected buyers will be notified that their connection requests were declined.
            This action can be undone individually.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Add a reason for rejecting (optional, applies to all)..."
          className="min-h-[80px] resize-none text-sm"
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject {count} Request{count !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main Table Component ----------

interface ConnectionRequestsTableProps {
  requests: AdminConnectionRequest[];
  isLoading: boolean;
  onRefresh?: () => void;
  showSourceFilter?: boolean;
  selectedSources?: string[];
  onSourcesChange?: (sources: string[]) => void;
}

export default function ConnectionRequestsTable({
  requests,
  isLoading,
  onRefresh,
  showSourceFilter = false,
  selectedSources = [],
  onSourcesChange,
}: ConnectionRequestsTableProps) {
  const { data: unreadCounts } = useUnreadMessageCounts();

  const {
    expandedRows,
    toggleExpanded,
    selectedIds,
    toggleSelection,
    selectAll,
    allSelected,
    someSelected,
    setSelectedIds,
    filteredRequests,
    flaggedCount,
    showFlaggedOnly,
    setShowFlaggedOnly,
    showBulkRejectDialog,
    setShowBulkRejectDialog,
    bulkRejectNote,
    setBulkRejectNote,
    handleBulkAction,
    updateStatusIsPending,
  } = useConnectionRequestsFilters(requests, selectedSources);

  if (isLoading) {
    return <ConnectionRequestsTableSkeleton />;
  }

  if (!requests || requests.length === 0) {
    return <ConnectionRequestsTableEmpty />;
  }

  if (filteredRequests.length === 0 && selectedSources.length > 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <SourceFilter
            selectedSources={selectedSources}
            onSourcesChange={onSourcesChange || (() => {})}
          />
          <div className="mt-4 text-center">
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">
              No requests found
            </h3>
            <p className="text-sm text-muted-foreground">
              No connection requests match the selected source filters.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={allSelected}
            onCheckedChange={selectAll}
            className="shrink-0"
            aria-label="Select all"
          />
          <span className="text-sm text-muted-foreground">
            {someSelected
              ? `${selectedIds.size} selected`
              : `${filteredRequests.length} of ${requests.length} connection request${requests.length !== 1 ? "s" : ""}`}
          </span>
          {showSourceFilter && onSourcesChange && (
            <SourceFilter
              selectedSources={selectedSources}
              onSourcesChange={onSourcesChange}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showFlaggedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
            className={
              showFlaggedOnly ? "bg-orange-500 hover:bg-orange-600 text-white" : ""
            }
          >
            <Flag
              className={`h-4 w-4 mr-2 ${showFlaggedOnly ? "fill-white" : ""}`}
            />
            Flagged{flaggedCount > 0 ? ` (${flaggedCount})` : ""}
          </Button>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
          <ScoreBuyersButton requests={requests} onRefresh={onRefresh} />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {someSelected && (
        <div className="sticky top-0 z-20 flex items-center gap-3 rounded-xl border-2 border-primary/20 bg-primary/[0.04] px-5 py-3 shadow-md backdrop-blur-sm">
          <span className="text-sm font-semibold text-foreground">
            {selectedIds.size} request{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleBulkAction("approved")}
              disabled={updateStatusIsPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Approve All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBulkRejectDialog(true)}
              disabled={updateStatusIsPending}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Reject All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Connection Requests */}
      <div className="space-y-4">
        {filteredRequests.map((request) => (
          <ConnectionRequestRow
            key={request.id}
            request={request}
            isExpanded={expandedRows.has(request.id)}
            onToggleExpanded={() => toggleExpanded(request.id)}
            unreadCount={unreadCounts?.byRequest[request.id] || 0}
            isSelected={selectedIds.has(request.id)}
            onSelectionChange={(checked) => toggleSelection(request.id, checked)}
          />
        ))}
      </div>

      {/* Bulk Reject Dialog */}
      <BulkRejectDialog
        open={showBulkRejectDialog}
        onOpenChange={setShowBulkRejectDialog}
        count={selectedIds.size}
        note={bulkRejectNote}
        onNoteChange={setBulkRejectNote}
        onConfirm={() =>
          handleBulkAction("rejected", bulkRejectNote.trim() || undefined)
        }
        isPending={updateStatusIsPending}
      />
    </div>
  );
}
