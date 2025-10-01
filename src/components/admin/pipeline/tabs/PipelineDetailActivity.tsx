import React, { useState } from 'react';
import { ArrowRight, User, Calendar, FileText, CheckCircle, Mail, Edit, Shield, LayoutList } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { formatDistanceToNow, format } from 'date-fns';
import { useDealActivities } from '@/hooks/admin/use-deal-activities';
import { CompleteAuditTrail } from '../CompleteAuditTrail';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  
  // Combine real activities with system-generated activities
  const activities: ActivityItem[] = [
    // System activity for deal creation
    {
      id: 'deal-created',
      type: 'deal_updated',
      title: 'Deal Created',
      description: `Deal created for ${deal.listing_title}`,
      timestamp: deal.deal_created_at || new Date().toISOString(),
      user: 'System',
      metadata: { action: 'created' }
    },
    // System activity for current stage
    {
      id: 'stage-current',
      type: 'stage_change',
      title: `Deal in ${deal.stage_name}`,
      description: `Deal currently in "${deal.stage_name}" stage`,
      timestamp: deal.deal_stage_entered_at || deal.deal_created_at || new Date().toISOString(),
      user: 'System',
      metadata: { to_stage: deal.stage_name }
    },
    // Real activities from database
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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'stage_change':
        return ArrowRight;
      case 'nda_status_changed':
      case 'fee_agreement_status_changed':
        return FileText;
      case 'nda_email_sent':
      case 'fee_agreement_email_sent':
        return Mail;
      case 'task_completed':
        return CheckCircle;
      case 'task_created':
        return Calendar;
      case 'task_assigned':
        return User;
      case 'email_sent':
        return Mail;
      case 'assignment_changed':
        return User;
      case 'deal_updated':
        return Edit;
      case 'follow_up':
        return User;
      default:
        return Calendar;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'stage_change':
        return 'bg-blue-500';
      case 'nda_status_changed':
      case 'fee_agreement_status_changed':
        return 'bg-emerald-500';
      case 'nda_email_sent':
      case 'fee_agreement_email_sent':
        return 'bg-purple-500';
      case 'task_completed':
        return 'bg-green-500';
      case 'task_created':
        return 'bg-blue-400';
      case 'task_assigned':
        return 'bg-indigo-500';
      case 'email_sent':
        return 'bg-purple-500';
      case 'assignment_changed':
        return 'bg-indigo-600';
      case 'deal_updated':
        return 'bg-amber-500';
      case 'follow_up':
        return 'bg-indigo-500';
      default:
        return 'bg-muted-foreground/40';
    }
  };

  const sortedActivities = activities.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Show audit trail view
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
      <div className="px-8 space-y-8 pb-8">
        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Activity Timeline</h2>
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
        {/* Activity Overview - Apple Clean */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Activity Overview</h2>
          
          <div className="grid grid-cols-3 gap-8">
            <div className="text-center space-y-1">
              <div className="text-2xl font-light text-foreground">{activities.length}</div>
              <div className="text-xs text-muted-foreground/70 font-mono">Total Events</div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-2xl font-light text-primary">
                {activities.filter(a => a.type === 'stage_change').length}
              </div>
              <div className="text-xs text-muted-foreground/70 font-mono">Stage Changes</div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-2xl font-light text-emerald-600">
                {activities.filter(a => ['nda_status_changed', 'fee_agreement_status_changed'].includes(a.type)).length}
              </div>
              <div className="text-xs text-muted-foreground/70 font-mono">Documents</div>
            </div>
          </div>
        </div>

        {/* Deal Velocity - Minimal */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Deal Velocity</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground/70 font-mono">Current Stage Time</span>
                <p className="text-sm font-medium text-foreground">
                  {deal.deal_stage_entered_at ? formatDistanceToNow(new Date(deal.deal_stage_entered_at)) : 'Unknown'}
                </p>
              </div>
              
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground/70 font-mono">Total Deal Age</span>
                <p className="text-sm font-medium text-foreground">
                  {deal.deal_created_at ? formatDistanceToNow(new Date(deal.deal_created_at)) : 'Unknown'}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70 font-mono">Pipeline Progress</span>
                <span className="text-muted-foreground/70 font-mono">{deal.stage_name}</span>
              </div>
              <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: '60%' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Activity Timeline - Apple Minimal */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Activity Timeline</h2>
          
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
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-1">
                {sortedActivities.map((activity, index) => {
                  const isRecent = new Date(activity.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                  
                  return (
                    <div key={activity.id} className="py-4 border-b border-border/10 last:border-b-0">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-1 h-1 rounded-full ${
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
                              <h3 className="text-sm font-medium text-foreground">{activity.title}</h3>
                              <p className="text-xs text-muted-foreground/70">{activity.description}</p>
                            </div>
                            
                            {isRecent && (
                              <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-mono">
                                Recent
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                            <div className="flex items-center gap-4">
                              <span className="font-mono">{activity.user}</span>
                              <span className="font-mono">
                                {activity.timestamp ? format(new Date(activity.timestamp), 'MMM d, yyyy') : 'Unknown'}
                              </span>
                            </div>
                            
                            <span className="font-mono">
                              {activity.timestamp ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true }) : 'Unknown'}
                            </span>
                          </div>
                          
                          {/* Activity Metadata Display */}
                          {activity.metadata && (
                            <div className="pt-2 space-y-1">
                              {/* Stage Change */}
                              {activity.type === 'stage_change' && activity.metadata.from_stage && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-1 rounded-md bg-muted/50 text-muted-foreground font-mono">
                                    {activity.metadata.from_stage}
                                  </span>
                                  <span className="text-muted-foreground/40">→</span>
                                  <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-mono">
                                    {activity.metadata.to_stage}
                                  </span>
                                </div>
                              )}
                              
                              {/* Document Actions */}
                              {(['nda_status_changed', 'fee_agreement_status_changed', 'nda_email_sent', 'fee_agreement_email_sent'].includes(activity.type)) && activity.metadata.document_type && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground/70">Document:</span>
                                  <span className="text-xs px-2 py-1 rounded-md bg-muted/50 text-foreground font-mono uppercase">
                                    {activity.metadata.document_type.replace('_', ' ')}
                                  </span>
                                </div>
                              )}
                              
                              {/* Task Actions */}
                              {(activity.type === 'task_created' || activity.type === 'task_completed' || activity.type === 'task_assigned') && (
                                <div className="space-y-1">
                                  {activity.metadata.priority && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground/70">Priority:</span>
                                      <span className={`text-xs px-2 py-1 rounded-md font-mono ${
                                        activity.metadata.priority === 'high' ? 'bg-red-100 text-red-700' :
                                        activity.metadata.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>
                                        {activity.metadata.priority}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
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
      </div>
    </div>
  );
}