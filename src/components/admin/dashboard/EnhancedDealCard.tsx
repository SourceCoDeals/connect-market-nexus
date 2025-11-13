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
  // Calculate if deal is stale (7+ days in same stage, excluding terminal stages)
  const isStale = () => {
    // Don't mark terminal stages as stale
    const terminalStages = ['Closed Won', 'Closed Lost'];
    if (deal.stage && terminalStages.includes(deal.stage.name)) {
      return false;
    }
    
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
      <div className="mb-5">
        <h3 className="font-semibold text-lg mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
          {deal.title || deal.listing?.title || 'Untitled Deal'}
        </h3>
        {deal.contact_name && (
          <p className="text-sm text-muted-foreground/80">
            {deal.contact_name}
            {deal.contact_email && (
              <span className="text-muted-foreground/60"> • {deal.contact_email}</span>
            )}
          </p>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="flex items-start gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground/70 mb-0.5">Value</p>
            <p className="text-base font-semibold text-foreground">
              {formatCompactCurrency(Number(deal.value) || 0)}
            </p>
          </div>
        </div>

        {deal.close_date && (
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground/70 mb-0.5">Closes</p>
              <p className="text-base font-semibold text-foreground">
                {new Date(deal.close_date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground/70 mb-0.5">Updated</p>
            <p className="text-base font-semibold text-foreground">
              {getRelativeTime(deal.updated_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground/70">Stage Progress</span>
          <span className="text-xs font-medium text-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Quick Action Indicators */}
      <div className="flex items-center gap-4 text-xs">
        {deal.followed_up ? (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Followed up</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Needs follow-up</span>
          </div>
        )}
        
        {isStale() && (
          <div className="flex items-center gap-1.5 text-destructive">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Stale (7+ days)</span>
          </div>
        )}
      </div>
    </div>
  );
}
