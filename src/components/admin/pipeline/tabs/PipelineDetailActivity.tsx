import React, { useState } from 'react';
import { ArrowRight, Calendar, CheckCircle, Mail, User, Shield, LayoutList, Edit } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { formatDistanceToNow, format } from 'date-fns';
import { useDealActivities } from '@/hooks/admin/use-deal-activities';
import { CompleteAuditTrail } from '../CompleteAuditTrail';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

interface PipelineDetailActivityProps {
  deal: Deal;
}

interface ActivityItem {
  id: string;
  type: 'stage_change' | 'nda_status_changed' | 'nda_email_sent' | 'fee_agreement_status_changed' | 'fee_agreement_email_sent' | 'task_completed' | 'task_created' | 'task_assigned' | 'email_sent' | 'assignment_changed' | 'deal_updated' | 'follow_up';
  title: string;
  description: string;
  timestamp: string;
  user: string;
  metadata?: any;
}

export function PipelineDetailActivity({ deal }: PipelineDetailActivityProps) {
  const { data: realActivities = [] } = useDealActivities(deal.deal_id);
  const [viewMode, setViewMode] = useState<'timeline' | 'audit'>('timeline');
  
  const activities: ActivityItem[] = [
    {
      id: 'deal-created',
      type: 'deal_updated',
      title: 'Deal Created',
      description: `Deal created for ${deal.listing_title}`,
      timestamp: deal.deal_created_at || new Date().toISOString(),
      user: 'System',
      metadata: { action: 'created' }
    },
    {
      id: 'stage-current',
      type: 'stage_change',
      title: `Deal in ${deal.stage_name}`,
      description: `Deal currently in "${deal.stage_name}" stage`,
      timestamp: deal.deal_stage_entered_at || deal.deal_created_at || new Date().toISOString(),
      user: 'System',
      metadata: { to_stage: deal.stage_name }
    },
    ...realActivities.map(activity => ({
      id: activity.id,
      type: activity.activity_type as ActivityItem['type'],
      title: activity.title,
      description: activity.description || activity.title,
      timestamp: activity.created_at,
      user: activity.admin?.email ? 
        `${activity.admin.first_name || ''} ${activity.admin.last_name || ''}`.trim() || activity.admin.email :
        'Admin',
      metadata: activity.metadata || {}
    }))
  ];

  const sortedActivities = activities.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (viewMode === 'audit') {
    return (
      <div className="flex-1 overflow-auto">
        <div className="pb-4 px-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('timeline')}
            className="gap-2"
          >
            <LayoutList className="w-4 h-4" />
            Back to Timeline
          </Button>
        </div>
        <CompleteAuditTrail deal={deal} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex gap-6 px-6 py-6">
        {/* Left Column - Activity Timeline */}
        <div className="flex-1 space-y-6 max-w-3xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Activity Timeline</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('audit')}
              className="gap-2"
            >
              <Shield className="w-4 h-4" />
              Complete Audit Trail
            </Button>
          </div>

          {/* Activity Timeline */}
          {sortedActivities.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mx-auto">
                <Calendar className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                <p className="text-xs text-muted-foreground/70">Activity will appear here as actions are taken</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-1">
                {sortedActivities.map((activity, index) => {
                  const isRecent = new Date(activity.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                  
                  return (
                    <div key={activity.id} className="py-4 border-b border-border/10 last:border-b-0">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            activity.type === 'stage_change' ? 'bg-primary' :
                            ['nda_status_changed', 'fee_agreement_status_changed'].includes(activity.type) ? 'bg-emerald-500' :
                            activity.type === 'task_completed' ? 'bg-emerald-500' :
                            ['email_sent', 'nda_email_sent', 'fee_agreement_email_sent'].includes(activity.type) ? 'bg-primary' :
                            activity.type === 'deal_updated' ? 'bg-amber-500' :
                            'bg-muted-foreground/40'
                          }`} />
                          {index < sortedActivities.length - 1 && (
                            <div className="w-px h-8 bg-border/10 mt-3" />
                          )}
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h4 className="text-sm font-medium text-foreground">{activity.title}</h4>
                              <p className="text-xs text-muted-foreground">{activity.description}</p>
                            </div>
                            
                            {isRecent && (
                              <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono">
                                Recent
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-3">
                              <span className="font-mono">{activity.user}</span>
                              <span className="font-mono">
                                {activity.timestamp ? format(new Date(activity.timestamp), 'MMM d, yyyy') : 'Unknown'}
                              </span>
                            </div>
                            
                            <span className="font-mono">
                              {activity.timestamp ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true }) : 'Unknown'}
                            </span>
                          </div>
                          
                          {/* Activity Metadata */}
                          {activity.metadata && activity.type === 'stage_change' && activity.metadata.from_stage && (
                            <div className="pt-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground font-mono">
                                  {activity.metadata.from_stage}
                                </span>
                                <span className="text-muted-foreground/40">→</span>
                                <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono">
                                  {activity.metadata.to_stage}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right Sidebar - Stats */}
        <div className="w-80 flex-shrink-0 space-y-6">
          {/* Activity Overview */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Activity Overview</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center space-y-1 p-3 border border-border/40 rounded-lg">
                <div className="text-2xl font-light text-foreground">{activities.length}</div>
                <div className="text-xs text-muted-foreground">Total Events</div>
              </div>
              <div className="text-center space-y-1 p-3 border border-border/40 rounded-lg">
                <div className="text-2xl font-light text-primary">
                  {activities.filter(a => a.type === 'stage_change').length}
                </div>
                <div className="text-xs text-muted-foreground">Stage Changes</div>
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Deal Velocity */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Deal Velocity</Label>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Current Stage Time</span>
                <p className="text-sm font-medium text-foreground">
                  {deal.deal_stage_entered_at ? formatDistanceToNow(new Date(deal.deal_stage_entered_at)) : 'Unknown'}
                </p>
              </div>
              
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Total Deal Age</span>
                <p className="text-sm font-medium text-foreground">
                  {deal.deal_created_at ? formatDistanceToNow(new Date(deal.deal_created_at)) : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Current Stage */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Current Stage</Label>
            
            <div className="p-3 border border-border/40 rounded-lg">
              <p className="text-sm font-medium text-foreground">{deal.stage_name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Since {deal.deal_stage_entered_at ? format(new Date(deal.deal_stage_entered_at), 'MMM d, yyyy') : 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
