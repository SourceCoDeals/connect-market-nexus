/**
 * DealSignalsPanel — Display and acknowledge AI-detected deal signals.
 */

import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingUp, Info, Zap, Check } from 'lucide-react';
import { useDealSignals, useAcknowledgeSignal } from '@/hooks/useDealSignals';
import { useToast } from '@/hooks/use-toast';
import type { SignalType } from '@/types/daily-tasks';

const SIGNAL_CONFIG: Record<
  SignalType,
  { icon: typeof AlertTriangle; color: string; badge: string }
> = {
  critical: { icon: Zap, color: 'text-red-600', badge: 'bg-red-100 text-red-800 border-red-200' },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  positive: {
    icon: TrendingUp,
    color: 'text-green-600',
    badge: 'bg-green-100 text-green-800 border-green-200',
  },
  neutral: {
    icon: Info,
    color: 'text-gray-600',
    badge: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

interface DealSignalsPanelProps {
  listingId?: string;
  dealId?: string;
}

export function DealSignalsPanel({ listingId, dealId }: DealSignalsPanelProps) {
  const { data: signals, isLoading } = useDealSignals({ listingId, dealId });
  const acknowledgeSignal = useAcknowledgeSignal();
  const { toast } = useToast();

  const handleAcknowledge = async (signalId: string) => {
    try {
      await acknowledgeSignal.mutateAsync(signalId);
    } catch (err) {
      toast({
        title: 'Failed to acknowledge signal',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!signals || signals.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No signals detected yet. Signals are extracted from call transcripts.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {signals.map((signal) => {
        const config = SIGNAL_CONFIG[signal.signal_type];
        const Icon = config.icon;
        const isAcknowledged = !!signal.acknowledged_at;

        return (
          <div
            key={signal.id}
            className={`rounded-md border px-3 py-2.5 ${isAcknowledged ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start gap-2">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-[10px] h-4 ${config.badge}`}>
                    {signal.signal_type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {signal.signal_category.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm">{signal.summary}</p>
                {signal.verbatim_quote && (
                  <p className="text-xs text-muted-foreground italic mt-1 border-l-2 pl-2">
                    &ldquo;{signal.verbatim_quote}&rdquo;
                  </p>
                )}
              </div>
              {!isAcknowledged && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs shrink-0"
                  onClick={() => handleAcknowledge(signal.id)}
                  disabled={acknowledgeSignal.isPending}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Ack
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
