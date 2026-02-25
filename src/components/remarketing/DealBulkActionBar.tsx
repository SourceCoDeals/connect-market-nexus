import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  FolderPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { exportDealsToCSV } from '@/lib/exportUtils';
import { toast as sonnerToast } from 'sonner';

export interface DealBulkActionBarProps {
  // Selection state
  selectedIds: Set<string>;
  deals: Array<{ id: string; is_priority_target?: boolean }>;
  onClearSelection: () => void;
  onRefetch: () => void;

  // Pipeline actions (non-active-deals trackers)
  onApproveToActiveDeals?: (dealIds: string[]) => void;
  isApproving?: boolean;
  onEnrichSelected?: (dealIds: string[], mode: 'all' | 'unenriched') => void;
  isEnriching?: boolean;

  // Active Deals–specific actions
  onSendToUniverse?: () => void;
  showMarketplaceActions?: boolean;

  // Common destructive actions
  onArchive?: () => void;
  isArchiving?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;

  // Integration actions
  onPushToDialer?: () => void;
  onPushToSmartlead?: () => void;
  onAddToList?: () => void;
}

export function DealBulkActionBar({
  selectedIds,
  deals,
  onClearSelection,
  onRefetch,
  onApproveToActiveDeals,
  isApproving,
  onEnrichSelected,
  isEnriching,
  onSendToUniverse,
  showMarketplaceActions,
  onArchive,
  isArchiving,
  onDelete,
  isDeleting,
  onPushToDialer,
  onPushToSmartlead,
  onAddToList,
}: DealBulkActionBarProps) {
  if (selectedIds.size === 0) return null;

  const dealIds = Array.from(selectedIds);
  const allPriority =
    dealIds.length > 0 &&
    dealIds.every((id) => deals?.find((d) => d.id === id)?.is_priority_target);

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
      sonnerToast.success(`${dealIds.length} deal(s) listed on marketplace`);
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
      sonnerToast.success(`${dealIds.length} deal(s) unlisted from marketplace`);
      onClearSelection();
      onRefetch();
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
      {/* Selection count + Clear */}
      <Badge variant="secondary" className="text-sm font-medium">
        {selectedIds.size} selected
      </Badge>
      <Button variant="ghost" size="sm" onClick={onClearSelection}>
        <XCircle className="h-4 w-4 mr-1" />
        Clear
      </Button>

      <div className="h-5 w-px bg-border" />

      {/* Pipeline actions: Approve + Enrich */}
      {onApproveToActiveDeals && (
        <Button
          size="sm"
          onClick={() => onApproveToActiveDeals(dealIds)}
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

      {onEnrichSelected && (
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

      {/* Active Deals–specific: Send to Universe */}
      {onSendToUniverse && (
        <Button size="sm" variant="outline" onClick={onSendToUniverse}>
          <FolderPlus className="h-4 w-4 mr-1" />
          Send to Universe
        </Button>
      )}

      {(onApproveToActiveDeals || onEnrichSelected || onSendToUniverse) && (
        <div className="h-5 w-px bg-border" />
      )}

      {/* Common actions */}
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

      <Button size="sm" variant="outline" className="gap-2" onClick={handleExportCSV}>
        <Download className="h-4 w-4" />
        Export CSV
      </Button>

      {onPushToDialer && (
        <Button size="sm" variant="outline" onClick={onPushToDialer} className="gap-2">
          <Phone className="h-4 w-4" />
          Push to Dialer
        </Button>
      )}

      {onPushToSmartlead && (
        <Button size="sm" variant="outline" onClick={onPushToSmartlead} className="gap-2">
          <Phone className="h-4 w-4" />
          Push to Smartlead
        </Button>
      )}

      {onAddToList && (
        <Button size="sm" variant="outline" onClick={onAddToList} className="gap-2">
          <ListChecks className="h-4 w-4" />
          Add to List
        </Button>
      )}

      {/* Active Deals–specific: Marketplace actions */}
      {showMarketplaceActions && (
        <>
          <div className="h-5 w-px bg-border" />
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-200 hover:bg-green-50 gap-2"
            onClick={handleListOnMarketplace}
          >
            <Globe className="h-4 w-4" />
            List on Marketplace
          </Button>
          <Button size="sm" variant="outline" onClick={handleUnlist} className="gap-2">
            <EyeOff className="h-4 w-4" />
            Unlist
          </Button>
        </>
      )}

      {/* Destructive actions */}
      {(onArchive || onDelete) && <div className="h-5 w-px bg-border" />}

      {onArchive && (
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

      {onDelete && (
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
  );
}
