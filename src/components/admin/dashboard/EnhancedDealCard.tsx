import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
// No icon imports needed
import { formatDistanceToNow } from 'date-fns';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useDealActivities } from '@/hooks/admin/use-deal-activities';
import { useUpdateDeal } from '@/hooks/admin/use-update-deal';
import { logDealActivity } from '@/lib/deal-activity-logger';
import { ActivityTimelineItem } from './ActivityTimelineItem';
import { QuickNoteInput } from './QuickNoteInput';
import { useQueryClient } from '@tanstack/react-query';

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
  expected_close_date?: string;
  probability?: number;
  contact_name?: string;
  contact_email?: string;
}

interface EnhancedDealCardProps {
  deal: Deal;
  onDealClick: (dealId: string) => void;
}

export function EnhancedDealCard({ deal, onDealClick }: EnhancedDealCardProps) {
  const { data: activities = [] } = useDealActivities(deal.id);
  
  const terminalStages = ['Closed Won', 'Closed Lost'];
  const isClosed = deal.stage && terminalStages.includes(deal.stage.name);
  const isClosedWon = deal.stage?.name === 'Closed Won';

  // Calculate if deal is stale (7+ days in same stage, excluding terminal stages)
  const isStale = useMemo(() => {
    if (isClosed) return false;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(deal.stage_entered_at) < weekAgo;
  }, [deal.stage_entered_at, isClosed]);

  // Get recent activities
  const recentActivities = useMemo(
    () => activities.slice(0, 3),
    [activities]
  );

  // No priority dot needed - using text badges instead

  // Format relative time
  const getRelativeTime = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  // Get days in stage
  const getDaysInStage = () => {
    const days = Math.floor(
      (new Date().getTime() - new Date(deal.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  // Quick actions removed - showing deal metrics instead

  // Closed deal simplified view
  if (isClosed) {
    return (
      <Card 
        onClick={() => onDealClick(deal.id)}
        className="opacity-75 bg-muted/5 cursor-pointer hover:border-border hover:shadow-sm transition-all"
      >
        <div className="px-6 py-4">
          <div className="flex items-start justify-between mb-2">
            <Badge variant={isClosedWon ? "default" : "secondary"} className="text-xs">
              {deal.stage?.name}
            </Badge>
            <span className="text-xs text-muted-foreground/60">
              Closed {getRelativeTime(deal.updated_at)}
            </span>
          </div>
          
          <h3 className="font-semibold text-base mb-1">
            {deal.title || deal.listing?.title || 'Untitled Deal'}
          </h3>
          <p className="text-sm text-muted-foreground/70 mb-3">
            {deal.contact_name}
            {deal.contact_email && ` • ${deal.contact_email}`}
          </p>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground/60">
            <span>Pipeline duration: {getDaysInStage()} days</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDealClick(deal.id);
              }}
              className="h-7 text-xs"
            >
              View details →
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Active deal detailed view
  return (
    <Card 
      onClick={() => onDealClick(deal.id)}
      className="group cursor-pointer hover:shadow-sm transition-all duration-200"
    >
      {/* ZONE 1: Status Bar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {getDaysInStage()} days in stage
          </span>
          {isStale && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Stale
            </span>
          )}
          {!deal.followed_up && !isStale && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Needs follow-up
            </span>
          )}
        </div>
        {deal.stage && (
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {deal.stage.name}
          </span>
        )}
      </div>

      {/* ZONE 2: Core Info */}
      <div className="px-6 py-3 space-y-1">
        <h3 className="font-semibold text-base leading-tight text-slate-900 dark:text-slate-100">
          {deal.title || deal.listing?.title || 'Untitled Deal'}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {deal.contact_name || 'No contact'}
          {deal.contact_email && ` · ${deal.contact_email}`}
        </p>
      </div>

      {/* ZONE 3: Activity Timeline */}
      {recentActivities.length > 0 && (
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            {recentActivities.map((activity) => (
              <ActivityTimelineItem key={activity.id} activity={activity} />
            ))}
            {activities.length > 3 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDealClick(deal.id);
                }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                View all {activities.length} activities →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ZONE 4: Deal Metrics */}
      <div className="px-6 pb-4 pt-3 border-t border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-3 gap-4 text-center">
          {deal.value && (
            <div>
              <p className="text-xs text-slate-500">Value</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                ${(Number(deal.value) / 1000).toFixed(0)}k
              </p>
            </div>
          )}
          {deal.probability && (
            <div>
              <p className="text-xs text-slate-500">Probability</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {deal.probability}%
              </p>
            </div>
          )}
          {deal.expected_close_date && (
            <div>
              <p className="text-xs text-slate-500">Expected close</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {new Date(deal.expected_close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          )}
          {!deal.value && !deal.probability && !deal.expected_close_date && (
            <div className="col-span-3">
              <p className="text-xs text-slate-500">
                Last updated {getRelativeTime(deal.updated_at)}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
