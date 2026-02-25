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
  XCircle,
  Star,
  Download,
  Archive,
  Trash2,
  Globe,
  EyeOff,
  ListChecks,
  CheckCircle2,
  Sparkles,
  Loader2,
  ChevronDown,
  Phone,
  Mail,
  FolderPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { exportDealsToCSV } from '@/lib/exportUtils';
import { toast as sonnerToast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DealBulkActionBarProps {
  /** Set of selected deal IDs */
  selectedIds: Set<string>;
  /** Full deal list to compute priority state – must have id & is_priority_target */
  deals: Array<{ id: string; is_priority_target?: boolean | null }>;
  /** Called when user clicks "Clear" */
  onClearSelection: () => void;
  /** Called after a mutation that should refresh the deal list */
  onRefetch: () => void;

  // ---------- Pipeline actions (Cap Target / GP Partner / Referred) ----------
  /** Show "Approve to Active Deals" button */
  showApprove?: boolean;
  onApprove?: (dealIds: string[]) => void;
  isApproving?: boolean;

  /** Show "Enrich Selected" dropdown */
  showEnrich?: boolean;
  onEnrichSelected?: (dealIds: string[], mode: 'all' | 'unenriched') => void;
  isEnriching?: boolean;

  // ---------- Common actions ----------
  /** Export CSV – enabled by default */
  showExportCSV?: boolean;
  /** Push to Dialer */
  showPushToDialer?: boolean;
  onPushToDialer?: () => void;
  /** Push to Smartlead */
  showPushToSmartlead?: boolean;
  onPushToSmartlead?: () => void;
  /** Add to List */
  showAddToList?: boolean;
  onAddToList?: () => void;

  // ---------- Active Deals specific ----------
  /** Show "Send to Universe" */
  showSendToUniverse?: boolean;
  onSendToUniverse?: () => void;
  /** Show marketplace actions (List / Unlist) */
  showMarketplace?: boolean;

  // ---------- Archive / Delete ----------
  showArchive?: boolean;
  onArchive?: () => void;
  isArchiving?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;

  // ---------- Archive/Delete confirmation dialogs ----------
  /** If provided, render built-in archive confirmation dialog */
  archiveDialogOpen?: boolean;
  onArchiveDialogChange?: (open: boolean) => void;
  onConfirmArchive?: () => void;
  /** If provided, render built-in delete confirmation dialog */
  deleteDialogOpen?: boolean;
  onDeleteDialogChange?: (open: boolean) => void;
  onConfirmDelete?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DealBulkActionBar({
  selectedIds,
  deals,
  onClearSelection,
  onRefetch,
  // Pipeline
  showApprove = false,
  onApprove,
  isApproving = false,
  showEnrich = false,
  onEnrichSelected,
  isEnriching = false,
  // Common
  showExportCSV = true,
  showPushToDialer = false,
  onPushToDialer,
  showPushToSmartlead = false,
  onPushToSmartlead,
  showAddToList = false,
  onAddToList,
  // Active Deals specific
  showSendToUniverse = false,
  onSendToUniverse,
  showMarketplace = false,
  // Archive / Delete
  showArchive = true,
  onArchive,
  isArchiving = false,
  showDelete = true,
  onDelete,
  isDeleting = false,
  // Dialogs
  archiveDialogOpen,
  onArchiveDialogChange,
  onConfirmArchive,
  deleteDialogOpen,
  onDeleteDialogChange,
  onConfirmDelete,
}: DealBulkActionBarProps) {
  if (selectedIds.size === 0) return null;

  const dealIds = Array.from(selectedIds);

  // Compute priority state
  const allPriority =
    dealIds.length > 0 &&
    dealIds.every((id) => deals?.find((d) => d.id === id)?.is_priority_target);

  // ----- Internal handlers for self-contained actions -----

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

  const handleListOnMarketplace = async () => {
    const { error } = await supabase
      .from('listings')
      .update({ is_internal_deal: false } as never)
      .in('id', dealIds);
    if (error) {
      sonnerToast.error('Failed to list on marketplace');
    } else {
      sonnerToast.success(`${dealIds.length} deal(s) listed`);
      onClearSelection();
      onRefetch();
    }
  };

  const handleUnlist = async () => {
    const { error } = await supabase
      .from('listings')
      .update({ is_internal_deal: true } as never)
      .in('id', dealIds);
    if (error) {
      sonnerToast.error('Failed to unlist from marketplace');
    } else {
      sonnerToast.success(`${dealIds.length} deal(s) unlisted`);
      onClearSelection();
      onRefetch();
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg flex-wrap">
        {/* ---- Selection indicator + Clear ---- */}
        <Badge variant="secondary" className="text-sm font-medium">
          {selectedIds.size} selected
        </Badge>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <XCircle className="h-4 w-4 mr-1" />
          Clear
        </Button>

        <div className="h-5 w-px bg-border" />

        {/* ---- Pipeline: Approve ---- */}
        {showApprove && onApprove && (
          <Button
            size="sm"
            onClick={() => onApprove(dealIds)}
            disabled={isApproving}
            className="gap-2"
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Approve to Active Deals
          </Button>
        )}

        {/* ---- Pipeline: Enrich ---- */}
        {showEnrich && onEnrichSelected && (
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
        )}

        {/* ---- Active Deals: Send to Universe ---- */}
        {showSendToUniverse && onSendToUniverse && (
          <Button size="sm" variant="outline" onClick={onSendToUniverse}>
            <FolderPlus className="h-4 w-4 mr-1" />
            Send to Universe
          </Button>
        )}

        {(showApprove || showEnrich || showSendToUniverse) && (
          <div className="h-5 w-px bg-border" />
        )}

        {/* ---- Mark as Priority ---- */}
        <Button
          size="sm"
          variant="outline"
          className={cn(
            'gap-2',
            allPriority
              ? 'text-muted-foreground'
              : 'text-amber-600 border-amber-200 hover:bg-amber-50',
          )}
          onClick={handleTogglePriority}
        >
          <Star className={cn('h-4 w-4', allPriority ? '' : 'fill-amber-500')} />
          {allPriority ? 'Remove Priority' : 'Mark as Priority'}
        </Button>

        {/* ---- Export CSV ---- */}
        {showExportCSV && (
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}

        {/* ---- Push to Dialer ---- */}
        {showPushToDialer && onPushToDialer && (
          <Button size="sm" variant="outline" onClick={onPushToDialer} className="gap-2">
            <Phone className="h-4 w-4" />
            Push to Dialer
          </Button>
        )}

        {/* ---- Push to Smartlead ---- */}
        {showPushToSmartlead && onPushToSmartlead && (
          <Button size="sm" variant="outline" onClick={onPushToSmartlead} className="gap-2">
            <Mail className="h-4 w-4" />
            Push to Smartlead
          </Button>
        )}

        {/* ---- Add to List ---- */}
        {showAddToList && onAddToList && (
          <Button size="sm" variant="outline" onClick={onAddToList} className="gap-2">
            <ListChecks className="h-4 w-4" />
            Add to List
          </Button>
        )}

        {/* ---- Marketplace (Active Deals only) ---- */}
        {showMarketplace && (
          <>
            <div className="h-5 w-px bg-border" />
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={handleListOnMarketplace}
            >
              <Globe className="h-4 w-4 mr-1" />
              List on Marketplace
            </Button>
            <Button size="sm" variant="outline" onClick={handleUnlist}>
              <EyeOff className="h-4 w-4 mr-1" />
              Unlist
            </Button>
          </>
        )}

        {/* ---- Archive / Delete ---- */}
        {(showArchive || showDelete) && <div className="h-5 w-px bg-border" />}

        {showArchive && (
          <Button
            size="sm"
            variant="outline"
            onClick={onArchive}
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

        {showDelete && (
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
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

      {/* ---- Archive Confirmation Dialog ---- */}
      {archiveDialogOpen !== undefined && onArchiveDialogChange && (
        <AlertDialog open={archiveDialogOpen} onOpenChange={onArchiveDialogChange}>
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
              <AlertDialogAction onClick={onConfirmArchive} disabled={isArchiving}>
                {isArchiving ? 'Archiving...' : 'Archive'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ---- Delete Confirmation Dialog ---- */}
      {deleteDialogOpen !== undefined && onDeleteDialogChange && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogChange}>
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
                onClick={onConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
