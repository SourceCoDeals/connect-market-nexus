import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Sun, Clock, Snowflake, Sparkles, Eye, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { differenceInDays, differenceInHours } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface ScoreWithEngagement {
  id: string;
  last_viewed_at: string | null;
  status: string;
}

interface OutreachRecord {
  score_id: string;
  status: string;
}

interface EngagementHeatmapInsightProps {
  scores: ScoreWithEngagement[];
  outreachRecords?: OutreachRecord[];
  className?: string;
}

interface EngagementBucket {
  level: 'hot' | 'warm' | 'stale' | 'cold' | 'new';
  label: string;
  count: number;
  approvedCount: number;
  icon: typeof Flame;
  color: string;
  bgColor: string;
}

const categorizeEngagement = (lastViewedAt: string | null): 'hot' | 'warm' | 'stale' | 'cold' | 'new' => {
  if (!lastViewedAt) return 'new';
  
  const viewedDate = new Date(lastViewedAt);
  const now = new Date();
  const hoursSince = differenceInHours(now, viewedDate);
  const daysSince = differenceInDays(now, viewedDate);
  
  if (hoursSince < 24) return 'hot';
  if (daysSince <= 7) return 'warm';
  if (daysSince <= 14) return 'stale';
  return 'cold';
};

export const EngagementHeatmapInsight = ({
  scores,
  outreachRecords = [],
  className,
}: EngagementHeatmapInsightProps) => {
  const buckets = useMemo(() => {
    const initial: Record<string, { total: number; approved: number }> = {
      hot: { total: 0, approved: 0 },
      warm: { total: 0, approved: 0 },
      stale: { total: 0, approved: 0 },
      cold: { total: 0, approved: 0 },
      new: { total: 0, approved: 0 },
    };
    
    scores.forEach(score => {
      const level = categorizeEngagement(score.last_viewed_at);
      initial[level].total++;
      if (score.status === 'approved') {
        initial[level].approved++;
      }
    });
    
    return [
      {
        level: 'hot' as const,
        label: 'Hot',
        count: initial.hot.total,
        approvedCount: initial.hot.approved,
        icon: Flame,
        color: 'text-orange-600',
        bgColor: 'bg-orange-500/10',
      },
      {
        level: 'warm' as const,
        label: 'Warm',
        count: initial.warm.total,
        approvedCount: initial.warm.approved,
        icon: Sun,
        color: 'text-amber-600',
        bgColor: 'bg-amber-500/10',
      },
      {
        level: 'stale' as const,
        label: 'Getting Stale',
        count: initial.stale.total,
        approvedCount: initial.stale.approved,
        icon: Clock,
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-500/10',
      },
      {
        level: 'cold' as const,
        label: 'Cold',
        count: initial.cold.total,
        approvedCount: initial.cold.approved,
        icon: Snowflake,
        color: 'text-blue-600',
        bgColor: 'bg-blue-500/10',
      },
      {
        level: 'new' as const,
        label: 'Never Viewed',
        count: initial.new.total,
        approvedCount: initial.new.approved,
        icon: Sparkles,
        color: 'text-purple-600',
        bgColor: 'bg-purple-500/10',
      },
    ];
  }, [scores]);
  
  const insights = useMemo(() => {
    const messages: { type: 'warning' | 'info' | 'success'; icon: typeof AlertCircle; message: string }[] = [];
    
    const staleApproved = buckets.find(b => b.level === 'stale')?.approvedCount || 0;
    const coldApproved = buckets.find(b => b.level === 'cold')?.approvedCount || 0;
    const newCount = buckets.find(b => b.level === 'new')?.count || 0;
    const hotCount = buckets.find(b => b.level === 'hot')?.count || 0;
    
    if (staleApproved + coldApproved > 0) {
      messages.push({
        type: 'warning',
        icon: AlertCircle,
        message: `${staleApproved + coldApproved} approved buyer${staleApproved + coldApproved > 1 ? 's' : ''} haven't been contacted in 7+ days`,
      });
    }
    
    if (newCount > 5) {
      messages.push({
        type: 'info',
        icon: Eye,
        message: `${newCount} buyers have never been reviewed`,
      });
    }
    
    if (hotCount > 0) {
      messages.push({
        type: 'success',
        icon: Flame,
        message: `${hotCount} buyer${hotCount > 1 ? 's' : ''} reviewed in the last 24 hours`,
      });
    }
    
    return messages;
  }, [buckets]);
  
  const totalScores = scores.length;
  const viewedCount = scores.filter(s => s.last_viewed_at).length;
  
  if (totalScores === 0) return null;
  
  return (
    <Collapsible defaultOpen={insights.some(i => i.type === 'warning')}>
      <Card className={cn('border-dashed', className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  Engagement Overview
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {viewedCount}/{totalScores} viewed
                </Badge>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 space-y-3">
            {/* Engagement Buckets */}
            <div className="flex flex-wrap gap-2">
              {buckets.filter(b => b.count > 0).map((bucket) => {
                const Icon = bucket.icon;
                return (
                  <div
                    key={bucket.level}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
                      bucket.bgColor,
                      bucket.color
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="font-medium">{bucket.count}</span>
                    <span className="opacity-75">{bucket.label}</span>
                    {bucket.approvedCount > 0 && (
                      <span className="text-[10px] opacity-60">
                        ({bucket.approvedCount} approved)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Insights */}
            {insights.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t">
                {insights.map((insight, index) => {
                  const Icon = insight.icon;
                  return (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center gap-2 text-xs',
                        insight.type === 'warning' && 'text-amber-600',
                        insight.type === 'info' && 'text-muted-foreground',
                        insight.type === 'success' && 'text-green-600'
                      )}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span>{insight.message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default EngagementHeatmapInsight;
