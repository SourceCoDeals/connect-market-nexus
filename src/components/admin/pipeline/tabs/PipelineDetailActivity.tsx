import React from 'react';
import { ArrowRight, User, Calendar, FileText, CheckCircle, Mail, Edit } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { formatDistanceToNow, format } from 'date-fns';
import { useDealActivities } from '@/hooks/admin/use-deal-activities';

interface PipelineDetailActivityProps {
  deal: Deal;
}

interface ActivityItem {
  id: string;
  type: 'stage_change' | 'document_signed' | 'task_completed' | 'email_sent' | 'deal_updated' | 'follow_up';
  title: string;
  description: string;
  timestamp: string;
  user: string;
  metadata?: any;
}

export function PipelineDetailActivity({ deal }: PipelineDetailActivityProps) {
  const { data: realActivities = [] } = useDealActivities(deal.deal_id);
  
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
      case 'document_signed':
        return FileText;
      case 'task_completed':
        return CheckCircle;
      case 'email_sent':
        return Mail;
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
      case 'document_signed':
        return 'bg-emerald-500';
      case 'task_completed':
        return 'bg-green-500';
      case 'email_sent':
        return 'bg-purple-500';
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-5 space-y-8">
        {/* Activity Summary - Apple Minimal */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Activity Summary</h4>
          
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-2xl font-semibold text-foreground">{activities.length}</div>
              <div className="text-xs text-muted-foreground/70">Total Events</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-blue-600">
                {activities.filter(a => a.type === 'stage_change').length}
              </div>
              <div className="text-xs text-muted-foreground/70">Stage Changes</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-emerald-600">
                {activities.filter(a => a.type === 'document_signed').length}
              </div>
              <div className="text-xs text-muted-foreground/70">Documents Signed</div>
            </div>
          </div>
        </div>

        {/* Deal Velocity - Clean Layout */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Deal Velocity</h4>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs text-muted-foreground/70">Time in Current Stage</label>
              <p className="text-sm font-medium text-foreground">
                {deal.deal_stage_entered_at ? formatDistanceToNow(new Date(deal.deal_stage_entered_at)) : 'Unknown'}
              </p>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground/70">Total Deal Age</label>
              <p className="text-sm font-medium text-foreground">
                {deal.deal_created_at ? formatDistanceToNow(new Date(deal.deal_created_at)) : 'Unknown'}
              </p>
            </div>
          </div>
          
          <div>
            <label className="text-xs text-muted-foreground/70">Stage Progress</label>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 bg-muted/40 rounded-full h-1.5">
                <div 
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: '60%' }} // This would be calculated based on stage position
                />
              </div>
              <span className="text-xs text-muted-foreground/70">60%</span>
            </div>
          </div>
        </div>

        {/* Activity Timeline - Minimal Design */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Activity Timeline</h4>
          
          {sortedActivities.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground/70">No activity recorded yet</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Activity will appear here as actions are taken</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedActivities.map((activity, index) => {
                const ActivityIcon = getActivityIcon(activity.type);
                const isRecent = new Date(activity.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                
                return (
                  <div key={activity.id} className="flex items-start gap-4">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full ${getActivityColor(activity.type)}`} />
                      {index < sortedActivities.length - 1 && (
                        <div className="w-px h-8 bg-border/20 mt-2" />
                      )}
                    </div>
                    
                    {/* Activity content */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h5 className="font-medium text-sm text-foreground">{activity.title}</h5>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">{activity.description}</p>
                        </div>
                        
                        {isRecent && (
                          <div className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                            Recent
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground/60">
                        <div className="flex items-center gap-4">
                          <span>{activity.user}</span>
                          <span>{activity.timestamp ? format(new Date(activity.timestamp), 'MMM d, yyyy') : 'Unknown'}</span>
                        </div>
                        
                        <span>{activity.timestamp ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true }) : 'Unknown'}</span>
                      </div>
                      
                      {/* Activity metadata */}
                      {activity.metadata && activity.type === 'stage_change' && activity.metadata.from_stage && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="px-2 py-0.5 rounded text-xs bg-muted/60 text-muted-foreground">
                            {activity.metadata.from_stage}
                          </div>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                          <div className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                            {activity.metadata.to_stage}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}