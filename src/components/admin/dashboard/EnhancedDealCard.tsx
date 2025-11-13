import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { formatCompactCurrency } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Deal {
  id: string;
  title?: string;
  value?: number;
  stage?: {
    name: string;
    color?: string;
  };
  listing?: {
    title?: string;
    revenue?: number;
    ebitda?: number;
  };
  followed_up?: boolean;
  stage_entered_at: string;
  updated_at: string;
  close_date?: string;
  probability?: number;
  contact_name?: string;
  contact_email?: string;
}

interface EnhancedDealCardProps {
  deal: Deal;
  onDealClick: (dealId: string) => void;
}

export function EnhancedDealCard({ deal, onDealClick }: EnhancedDealCardProps) {
  // Calculate if deal is stale (7+ days in same stage)
  const isStale = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(deal.stage_entered_at) < weekAgo;
  };

  // Determine priority badge
  const getPriorityBadge = () => {
    if (isStale()) {
      return <Badge variant="destructive" className="text-xs">Stale</Badge>;
    }
    if (!deal.followed_up) {
      return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">Follow-up</Badge>;
    }
    const avgValue = 50000; // Placeholder - would calculate from all deals
    if ((Number(deal.value) || 0) > avgValue * 2) {
      return <Badge variant="default" className="text-xs">High Value</Badge>;
    }
    return null;
  };

  // Format relative time
  const getRelativeTime = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  // Calculate progress based on probability
  const progress = deal.probability || 0;

  return (
    <div
      onClick={() => onDealClick(deal.id)}
      className="border border-border/50 rounded-lg p-6 bg-card hover:border-border hover:shadow-sm transition-all cursor-pointer group"
    >
      {/* Header with badges */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {getPriorityBadge()}
        </div>
        {deal.stage && (
          <Badge 
            variant="outline" 
            className="text-xs"
            style={deal.stage.color ? { 
              borderColor: deal.stage.color,
              color: deal.stage.color,
            } : {}}
          >
            {deal.stage.name}
          </Badge>
        )}
      </div>

      {/* Deal Title and Company */}
      <div className="mb-4">
        <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors line-clamp-1">
          {deal.title || deal.listing?.title || 'Untitled Deal'}
        </h3>
        {deal.contact_name && (
          <p className="text-sm text-muted-foreground">
            {deal.contact_name}
            {deal.contact_email && (
              <span className="text-muted-foreground/60"> • {deal.contact_email}</span>
            )}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border/30 my-4" />

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground/60" />
          <div>
            <p className="text-xs text-muted-foreground">Value</p>
            <p className="text-sm font-semibold">
              {formatCompactCurrency(Number(deal.value) || 0)}
            </p>
          </div>
        </div>

        {deal.close_date && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground/60" />
            <div>
              <p className="text-xs text-muted-foreground">Closes</p>
              <p className="text-sm font-semibold">
                {new Date(deal.close_date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground/60" />
          <div>
            <p className="text-xs text-muted-foreground">Updated</p>
            <p className="text-sm font-semibold">
              {getRelativeTime(deal.updated_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Stage Progress</span>
          <span className="text-xs font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Quick Action Indicators */}
      <div className="flex items-center gap-3 text-xs">
        {deal.followed_up ? (
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Followed up</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Needs follow-up</span>
          </div>
        )}
        
        {isStale() && (
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Stale (7+ days)</span>
          </div>
        )}
      </div>
    </div>
  );
}
