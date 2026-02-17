import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Sparkles,
  Loader2,
  ChevronDown,
  Star,
  Archive,
  Trash2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportDealsToCSV } from "@/lib/exportUtils";
import { toast as sonnerToast } from "sonner";
import { useToast } from "@/hooks/use-toast";

interface CapTargetBulkActionsProps {
  selectedIds: Set<string>;
  deals: any[] | undefined;
  isPushing: boolean;
  isEnriching: boolean;
  isArchiving: boolean;
  isDeleting: boolean;
  onPushToAllDeals: (dealIds: string[]) => void;
  onEnrichSelected: (dealIds: string[], mode: "all" | "unenriched") => void;
  onClearSelection: () => void;
  onRefetch: () => void;
  // Archive dialog
  showArchiveDialog: boolean;
  setShowArchiveDialog: (v: boolean) => void;
  onBulkArchive: () => void;
  // Delete dialog
  showDeleteDialog: boolean;
  setShowDeleteDialog: (v: boolean) => void;
  onBulkDelete: () => void;
}

export function CapTargetBulkActions({
  selectedIds,
  deals,
  isPushing,
  isEnriching,
  isArchiving,
  isDeleting,
  onPushToAllDeals,
  onEnrichSelected,
  onClearSelection,
  onRefetch,
  showArchiveDialog,
  setShowArchiveDialog,
  onBulkArchive,
  showDeleteDialog,
  setShowDeleteDialog,
  onBulkDelete,
}: CapTargetBulkActionsProps) {
  const { toast } = useToast();

  if (selectedIds.size === 0) return null;

  const dealIds = Array.from(selectedIds);
  const allPriority = dealIds.length > 0 && dealIds.every(id => deals?.find(d => d.id === id)?.is_priority_target);

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <span className="text-sm font-medium">
          {selectedIds.size} deal{selectedIds.size !== 1 ? "s" : ""} selected
        </span>
        <Button
          size="sm"
          onClick={() => onPushToAllDeals(dealIds)}
          disabled={isPushing}
          className="gap-2"
        >
          {isPushing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Approve to All Deals
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={isEnriching}
              className="gap-2"
            >
              {isEnriching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Enrich Selected
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onEnrichSelected(dealIds, "unenriched")}>
              Enrich Unenriched
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEnrichSelected(dealIds, "all")}>
              Re-enrich All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-5 w-px bg-border" />

        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const newValue = !allPriority;
            const { error } = await supabase
              .from("listings")
              .update({ is_priority_target: newValue } as never)
              .in("id", dealIds);
            if (error) {
              toast({ title: "Error", description: "Failed to update priority" });
            } else {
              toast({ title: newValue ? "Priority Set" : "Priority Removed", description: `${dealIds.length} deal(s) updated` });
              onClearSelection();
              onRefetch();
            }
          }}
          className={cn("gap-2", allPriority ? "text-muted-foreground" : "text-amber-600 border-amber-200 hover:bg-amber-50")}
        >
          <Star className={cn("h-4 w-4", allPriority ? "" : "fill-amber-500")} />
          {allPriority ? "Remove Priority" : "Mark as Priority"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={async () => {
            const result = await exportDealsToCSV(dealIds);
            if (result.success) {
              sonnerToast.success(`${result.count} deal(s) exported to CSV`);
            } else {
              sonnerToast.error(result.error || "Export failed");
            }
          }}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowArchiveDialog(true)}
          disabled={isArchiving}
          className="gap-2"
        >
          {isArchiving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          Archive
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isDeleting}
          className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete
        </Button>

        <div className="h-5 w-px bg-border" />

        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
        >
          Clear
        </Button>
      </div>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedIds.size} Deal(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the selected deals to the Inactive tab. They can be found there later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onBulkArchive} disabled={isArchiving}>
              {isArchiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Permanently Delete {selectedIds.size} Deal(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected deals and all related data (scores, enrichment records). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onBulkDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
