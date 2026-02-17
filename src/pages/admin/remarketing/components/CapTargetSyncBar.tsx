import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

interface CapTargetSyncBarProps {
  isSyncing: boolean;
  syncProgress: { inserted: number; updated: number; skipped: number; excluded: number; page: number };
  syncSummaryOpen: boolean;
  setSyncSummaryOpen: (v: boolean) => void;
  syncSummary: { inserted: number; updated: number; skipped: number; excluded: number; status: "success" | "error"; message?: string } | null;
  onSync: () => void;
  onCancelSync: () => void;
}

export function CapTargetSyncBar({
  isSyncing,
  syncProgress,
  syncSummaryOpen,
  setSyncSummaryOpen,
  syncSummary,
  onSync,
  onCancelSync,
}: CapTargetSyncBarProps) {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isSyncing}
        onClick={onSync}
      >
        {isSyncing ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-1" />
        )}
        Sync Sheet
      </Button>

      {/* Sync progress bar */}
      {isSyncing && (
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Page {syncProgress.page}...</span>
              <span>+{syncProgress.inserted} new, ~{syncProgress.updated} updated</span>
            </div>
            <Progress value={undefined} className="h-1.5 animate-pulse" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={onCancelSync}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Sync summary dialog */}
      <Dialog open={syncSummaryOpen} onOpenChange={setSyncSummaryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {syncSummary?.status === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <RefreshCw className="h-5 w-5 text-destructive" />
              )}
              {syncSummary?.status === "success" ? "Sync Complete" : "Sync Failed"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-emerald-600">{syncSummary?.inserted ?? 0}</p>
                <p className="text-xs text-muted-foreground">Inserted</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-blue-600">{syncSummary?.updated ?? 0}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-muted-foreground">{syncSummary?.skipped ?? 0}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              {(syncSummary?.excluded ?? 0) > 0 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-2xl font-bold text-orange-600">{syncSummary?.excluded ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Excluded</p>
                </div>
              )}
            </div>
            {syncSummary?.status === "error" && syncSummary.message && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{syncSummary.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSyncSummaryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
