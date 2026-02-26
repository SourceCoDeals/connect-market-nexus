import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2,
  Sparkles,
  Loader2,
  ChevronDown,
  Star,
  Archive,
  Trash2,
  Download,
  Phone,
  ListChecks,
  XCircle,
  FolderPlus,
  Mail,
  Send,
  Zap,
  ThumbsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { exportDealsToCSV } from '@/lib/exportUtils';
import { toast as sonnerToast } from 'sonner';
import { useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DealBulkActionBarProps {
  /** Set of selected deal IDs */
  selectedIds: Set<string>;
  /** Full list of deals visible on this page (used to check priority state) */
  deals: Array<{ id: string; is_priority_target?: boolean | null }>;
  /** Clear the selection */
  onClearSelection: () => void;
  /** Called after any internal mutation (priority, etc.) so parent can refetch */
  onRefetch: () => void;

  /* ---- Pipeline actions ---- */
  onApproveToActiveDeals?: (dealIds: string[]) => void;
  isPushing?: boolean;

  onEnrichSelected?: (dealIds: string[], mode?: 'all' | 'unenriched') => void;
  /** Show enrich dropdown with mode options (default: false = plain button) */
  enrichDropdown?: boolean;
  isEnriching?: boolean;

  /* ---- Valuation Leads: combined push+enrich ---- */
  onPushAndEnrich?: (dealIds: string[]) => void;
  isPushAndEnriching?: boolean;
  onReEnrichPushed?: (dealIds: string[]) => void;
  isReEnrichingPushed?: boolean;

  /* ---- Common actions ---- */
  onPushToDialer?: () => void;
  onPushToSmartlead?: () => void;
  onPushToHeyreach?: () => void;
  onAddToList?: () => void;

  /* ---- Overrides ---- */
  onExportCSV?: () => void;
  /** Hide the priority toggle (e.g. for leads that aren't in the listings table) */
  showPriorityToggle?: boolean;

  /* ---- Not a Fit ---- */
  onMarkNotFit?: () => void;
  isMarkingNotFit?: boolean;

  /* ---- Destructive ---- */
  onArchive?: () => void;
  isArchiving?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;

  /* ---- Active Deals only ---- */
  onSendToUniverse?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DealBulkActionBar({
  selectedIds,
  deals,
  onClearSelection,
  onRefetch,
  onApproveToActiveDeals,
  isPushing,
  onEnrichSelected,
  enrichDropdown,
  isEnriching,
  onPushAndEnrich,
  isPushAndEnriching,
  onReEnrichPushed,
  isReEnrichingPushed,
  onPushToDialer,
  onPushToSmartlead,
  onPushToHeyreach,
  onAddToList,
  onExportCSV,
  showPriorityToggle = true,
  onMarkNotFit,
  isMarkingNotFit,
  onArchive,
  isArchiving,
  onDelete,
  isDeleting,
  onSendToUniverse,
}: DealBulkActionBarProps) {
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNotFitDialog, setShowNotFitDialog] = useState(false);

  if (selectedIds.size === 0) return null;

  const dealIds = Array.from(selectedIds);
  const allPriority =
    dealIds.length > 0 &&
    dealIds.every((id) => deals?.find((d) => d.id === id)?.is_priority_target);

  /* ---------- Internal handlers ---------- */

  const handleTogglePriority = async () => {
    const newValue = !allPriority;
    const { error } = await supabase
      .from('listings')
      .update({ is_priority_target: newValue } as never)
      .in('id', dealIds);
    if (error) {
      sonnerToast.error('Failed to update priority');
    } else {
      sonnerToast.success(
        newValue
          ? `${dealIds.length} deal(s) marked as priority`
          : `${dealIds.length} deal(s) priority removed`,
      );
      onClearSelection();
      onRefetch();
    }
  };

  const handleExportCSV = async () => {
    const result = await exportDealsToCSV(dealIds);
    if (result.success) {
      sonnerToast.success(`${result.count} deal(s) exported to CSV`);
    } else {
      sonnerToast.error(result.error || 'Export failed');
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg flex-wrap">
        {/* Selection info & clear */}
        <Badge variant="secondary" className="text-sm font-medium">
          {selectedIds.size} selected
        </Badge>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <XCircle className="h-4 w-4 mr-1" />
          Clear
        </Button>

        {/* ---- Send to Universe (Active Deals only) ---- */}
        {onSendToUniverse && (
          <>
            <div className="h-5 w-px bg-border" />
            <Button size="sm" variant="outline" onClick={onSendToUniverse}>
              <FolderPlus className="h-4 w-4 mr-1" />
              Send to Universe
            </Button>
          </>
        )}

        {/* ---- Pipeline: Approve, Push & Enrich, Re-Enrich ---- */}
        {(onApproveToActiveDeals || onPushAndEnrich || onEnrichSelected) && <div className="h-5 w-px bg-border" />}
        {onApproveToActiveDeals && (
          <Button
            size="sm"
            onClick={() => onApproveToActiveDeals(dealIds)}
            disabled={isPushing || isPushAndEnriching}
            className="gap-2"
          >
            {isPushing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Approve to Active Deals
          </Button>
        )}
        {onPushAndEnrich && (
          <Button
            size="sm"
            onClick={() => onPushAndEnrich(dealIds)}
            disabled={isPushAndEnriching || isPushing}
            className="gap-2"
          >
            {isPushAndEnriching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Push &amp; Enrich
          </Button>
        )}
        {onReEnrichPushed && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onReEnrichPushed(dealIds)}
            disabled={isReEnrichingPushed}
            className="gap-2"
          >
            {isReEnrichingPushed ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Re-Enrich Pushed
          </Button>
        )}
        {onEnrichSelected && enrichDropdown ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={isEnriching} className="gap-2">
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
              <DropdownMenuItem onClick={() => onEnrichSelected(dealIds, 'unenriched')}>
                Enrich Unenriched
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEnrichSelected(dealIds, 'all')}>
                Re-enrich All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : onEnrichSelected ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEnrichSelected(dealIds)}
            disabled={isEnriching}
            className="gap-2"
          >
            {isEnriching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Enrich Selected
          </Button>
        ) : null}

        {/* ---- Common actions ---- */}
        <div className="h-5 w-px bg-border" />

        {/* Priority toggle */}
        {showPriorityToggle && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTogglePriority}
            className={cn(
              'gap-2',
              allPriority
                ? 'text-muted-foreground'
                : 'text-amber-600 border-amber-200 hover:bg-amber-50',
            )}
          >
            <Star className={cn('h-4 w-4', allPriority ? '' : 'fill-amber-500')} />
            {allPriority ? 'Remove Priority' : 'Mark as Priority'}
          </Button>
        )}

        {/* Export CSV */}
        <Button size="sm" variant="outline" onClick={onExportCSV || handleExportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>

        {/* Dialer */}
        {onPushToDialer && (
          <Button size="sm" variant="outline" onClick={onPushToDialer} className="gap-2">
            <Phone className="h-4 w-4" />
            Dialer
          </Button>
        )}

        {/* Smartlead */}
        {onPushToSmartlead && (
          <Button size="sm" variant="outline" onClick={onPushToSmartlead} className="gap-2">
            <Mail className="h-4 w-4" />
            Smartlead
          </Button>
        )}

        {/* Heyreach */}
        {onPushToHeyreach && (
          <Button size="sm" variant="outline" onClick={onPushToHeyreach} className="gap-2">
            <Send className="h-4 w-4" />
            Heyreach
          </Button>
        )}

        {/* Add to List */}
        {onAddToList && (
          <Button size="sm" variant="outline" onClick={onAddToList} className="gap-2">
            <ListChecks className="h-4 w-4" />
            Add to List
          </Button>
        )}

        {/* ---- Not a Fit ---- */}
        {onMarkNotFit && (
          <>
            <div className="h-5 w-px bg-border" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNotFitDialog(true)}
              disabled={isMarkingNotFit}
              className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              {isMarkingNotFit ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsDown className="h-4 w-4" />
              )}
              Not a Fit
            </Button>
          </>
        )}

        {/* ---- Archive / Delete ---- */}
        {(onArchive || onDelete) && <div className="h-5 w-px bg-border" />}
        {onArchive && (
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
        )}
        {onDelete && (
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
        )}
      </div>

      {/* Archive Confirmation Dialog */}
      {onArchive && (
        <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive {selectedIds.size} Deal(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                This will move the selected deals to the Inactive tab. They can be found there
                later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onArchive();
                  setShowArchiveDialog(false);
                }}
                disabled={isArchiving}
              >
                {isArchiving ? 'Archiving...' : 'Archive'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Confirmation Dialog */}
      {onDelete && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">
                Permanently Delete {selectedIds.size} Deal(s)?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the selected deals and all related data (scores,
                enrichment records). This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete();
                  setShowDeleteDialog(false);
                }}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Not a Fit Confirmation Dialog */}
      {onMarkNotFit && (
        <AlertDialog open={showNotFitDialog} onOpenChange={setShowNotFitDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark {selectedIds.size} Deal(s) as Not a Fit?</AlertDialogTitle>
              <AlertDialogDescription>
                These deals will be marked as &ldquo;Not a Fit&rdquo; and hidden from the default
                view. You can show them again using the &ldquo;Show Not Fit&rdquo; toggle.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onMarkNotFit();
                  setShowNotFitDialog(false);
                }}
                disabled={isMarkingNotFit}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isMarkingNotFit ? 'Marking...' : 'Mark as Not a Fit'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
