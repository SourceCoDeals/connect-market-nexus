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
  const terminalStages = ['Closed Won', 'Closed Lost'];
  const isClosed = deal.stage && terminalStages.includes(deal.stage.name);

  // Calculate if deal is stale (7+ days in same stage, excluding terminal stages)
  const isStale = () => {
    if (isClosed) return false;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(deal.stage_entered_at) < weekAgo;
  };

  // Determine priority badge (only for active deals)
  const getPriorityBadge = () => {
    if (isClosed) return null;
    
    if (isStale()) {
      return <Badge variant="destructive" className="text-xs">Stale</Badge>;
    }
    if (!deal.followed_up) {
      return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">Follow-up</Badge>;
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

  // Calculate progress based on probability (only for active deals)
  const progress = isClosed ? 100 : (deal.probability || 0);

  return (
    <div
      onClick={() => onDealClick(deal.id)}
      className={`border border-border/50 rounded-lg p-6 bg-card hover:border-border hover:shadow-sm transition-all cursor-pointer group ${
        isClosed ? 'opacity-60 bg-muted/10' : ''
      }`}
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
      {!isClosed && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground/70 mb-0.5">Last contact</p>
              <p className="text-sm font-medium text-foreground">
                {getRelativeTime(deal.updated_at)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground/70 mb-0.5">In stage</p>
              <p className="text-sm font-medium text-foreground">
                {getRelativeTime(deal.stage_entered_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {isClosed && (
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground/70 mb-0.5">Closed</p>
              <p className="text-sm font-medium text-foreground">
                {getRelativeTime(deal.updated_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar - Only for active deals */}
      {!isClosed && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground/70">Progress</span>
            <span className="text-xs font-medium text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Quick Action Indicators - Only for active deals */}
      {!isClosed && (
        <div className="flex items-center gap-3 text-xs">
          {deal.followed_up ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-medium">Followed up</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="font-medium">Needs follow-up</span>
            </div>
          )}
          
          {isStale() && (
            <div className="flex items-center gap-1.5 text-destructive">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-medium">Stale</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
