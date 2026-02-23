import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Zap, Sparkles, Download, Archive } from 'lucide-react';
import type { ValuationLead } from './types';
import { exportLeadsToCSV } from './helpers';

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  filteredLeads: ValuationLead[];
  isPushing: boolean;
  isPushEnriching: boolean;
  isReEnriching: boolean;
  onClearSelection: () => void;
  onPushToAllDeals: (ids: string[]) => void;
  onPushAndEnrich: (ids: string[]) => void;
  onReEnrich: (ids: string[]) => void;
  onArchive: (ids: string[]) => void;
}

export function BulkActionsBar({
  selectedIds,
  filteredLeads,
  isPushing,
  isPushEnriching,
  isReEnriching,
  onClearSelection,
  onPushToAllDeals,
  onPushAndEnrich,
  onReEnrich,
  onArchive,
}: BulkActionsBarProps) {
  if (selectedIds.size === 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <Badge variant="secondary" className="text-sm font-medium">
        {selectedIds.size} selected
      </Badge>
      <Button variant="ghost" size="sm" onClick={onClearSelection}>
        <XCircle className="h-4 w-4 mr-1" />
        Clear
      </Button>

      <div className="h-5 w-px bg-border" />

      <Button
        size="sm"
        variant="outline"
        onClick={() => onPushToAllDeals(Array.from(selectedIds))}
        disabled={isPushing || isPushEnriching}
        className="gap-2"
      >
        {isPushing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Push to All Deals
      </Button>
      <Button
        size="sm"
        onClick={() => onPushAndEnrich(Array.from(selectedIds))}
        disabled={isPushEnriching || isPushing}
        className="gap-2"
      >
        {isPushEnriching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        Push &amp; Enrich
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onReEnrich(Array.from(selectedIds))}
        disabled={isReEnriching}
        className="gap-2"
      >
        {isReEnriching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Re-Enrich Pushed
      </Button>

      <div className="h-5 w-px bg-border" />

      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const selected = filteredLeads.filter((l) => selectedIds.has(l.id));
          exportLeadsToCSV(selected);
        }}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
      <div className="h-5 w-px bg-border" />
      <Button
        size="sm"
        variant="outline"
        onClick={() => onArchive(Array.from(selectedIds))}
        className="gap-2 text-destructive hover:text-destructive"
      >
        <Archive className="h-4 w-4" />
        Archive
      </Button>
    </div>
  );
}
