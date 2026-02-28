import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, RotateCcw, History } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface RejectedBuyerRecord {
  buyer_id: string;
  company_name: string;
  pe_firm_name?: string | null;
  rejection_reason: string;
  rejection_notes?: string | null;
  rejected_at: string;
  rejected_by?: string | null;
}

interface RejectionHistoryProps {
  rejections: RejectedBuyerRecord[];
  onReverse: (buyerId: string) => void;
  isReversing?: boolean;
}

export function RejectionHistory({
  rejections,
  onReverse,
  isReversing,
}: RejectionHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (rejections.length === 0) return null;

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button
        type="button"
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Rejection History
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {rejections.length}
          </Badge>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-border/20">
          {rejections.map((r) => {
            const displayName = r.pe_firm_name
              ? `${r.company_name} (${r.pe_firm_name})`
              : r.company_name;

            return (
              <div
                key={r.buyer_id}
                className="px-4 py-2.5 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs font-medium text-foreground truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.rejection_reason}
                    {r.rejection_notes && (
                      <span className="text-muted-foreground/60"> — {r.rejection_notes}</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50">
                    {formatDistanceToNow(new Date(r.rejected_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 text-xs text-muted-foreground hover:text-primary flex-shrink-0',
                  )}
                  onClick={() => onReverse(r.buyer_id)}
                  disabled={isReversing}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Restore
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
