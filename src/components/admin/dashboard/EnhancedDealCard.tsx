import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Clock, Calendar, MessageSquare, Circle } from 'lucide-react';
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
  const [isAddingNote, setIsAddingNote] = useState(false);
  const { data: activities = [] } = useDealActivities(deal.id);
  const updateDeal = useUpdateDeal();
  const queryClient = useQueryClient();
  
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

  // Get priority dot (minimal indicator)
  const getPriorityDot = () => {
    if (isClosed) return null;
    if (isStale) {
      return <div className="w-2 h-2 rounded-full bg-destructive" />;
    }
    if (!deal.followed_up) {
      return <div className="w-2 h-2 rounded-full bg-amber-500" />;
    }
    return <div className="w-2 h-2 rounded-full bg-emerald-500" />;
  };

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

  // Handle mark as followed up
  const handleMarkFollowedUp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    await updateDeal.mutateAsync({
      dealId: deal.id,
      updates: {
        followed_up: !deal.followed_up,
      },
    });

    await logDealActivity({
      dealId: deal.id,
      activityType: 'follow_up',
      title: 'Follow-up completed',
      description: deal.followed_up ? 'Unmarked as followed up' : 'Marked as followed up',
    });
  };

  // Handle quick note
  const handleQuickNote = async (noteText: string) => {
    await logDealActivity({
      dealId: deal.id,
      activityType: 'task_created',
      title: 'Quick note added',
      description: noteText,
    });

    setIsAddingNote(false);
    queryClient.invalidateQueries({ queryKey: ['deal-activities', deal.id] });
  };

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
      className="group cursor-pointer hover:shadow-md transition-all duration-200 border-border/40 hover:border-border"
    >
      {/* ZONE 1: Status Bar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {getPriorityDot()}
          <span className="text-xs text-muted-foreground/70">
            {getDaysInStage()} days in stage
          </span>
        </div>
        {deal.stage && (
          <Badge variant="outline" className="text-xs">
            {deal.stage.name}
          </Badge>
        )}
      </div>

      {/* ZONE 2: Core Info */}
      <div className="px-6 py-3 space-y-1">
        <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
          {deal.title || deal.listing?.title || 'Untitled Deal'}
        </h3>
        <p className="text-sm text-muted-foreground/70">
          {deal.contact_name || 'No contact'}
          {deal.contact_email && ` • ${deal.contact_email}`}
        </p>
      </div>

      {/* ZONE 3: Activity Timeline */}
      {recentActivities.length > 0 && (
        <div className="px-6 py-3 border-t border-border/30">
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
                className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
              >
                View all {activities.length} activities →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ZONE 4: Quick Actions */}
      <div className="px-6 pb-4 pt-3 border-t border-border/30">
        {isAddingNote ? (
          <QuickNoteInput 
            onSubmit={handleQuickNote}
            onCancel={() => setIsAddingNote(false)}
          />
        ) : (
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant={deal.followed_up ? "secondary" : "ghost"}
              onClick={handleMarkFollowedUp}
              className="h-7 text-xs"
            >
              {deal.followed_up ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Followed up
                </>
              ) : (
                <>
                  <Circle className="h-3 w-3 mr-1" />
                  Mark followed up
                </>
              )}
            </Button>
            
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingNote(true);
              }}
              className="h-7 text-xs"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Note
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
