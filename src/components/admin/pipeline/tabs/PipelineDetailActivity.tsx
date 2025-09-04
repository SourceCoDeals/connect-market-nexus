import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
      user: 'Admin', // Could be enhanced with actual admin names
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
        return 'text-blue-600 bg-blue-50';
      case 'document_signed':
        return 'text-emerald-600 bg-emerald-50';
      case 'task_completed':
        return 'text-green-600 bg-green-50';
      case 'email_sent':
        return 'text-purple-600 bg-purple-50';
      case 'deal_updated':
        return 'text-amber-600 bg-amber-50';
      case 'follow_up':
        return 'text-indigo-600 bg-indigo-50';
      default:
        return 'text-muted-foreground bg-muted/50';
    }
  };

  const sortedActivities = activities.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        {/* Activity Summary */}
        <Card className="p-5 border-border/40">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{activities.length}</div>
              <div className="text-xs text-muted-foreground">Total Events</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {activities.filter(a => a.type === 'stage_change').length}
              </div>
              <div className="text-xs text-muted-foreground">Stage Changes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {activities.filter(a => a.type === 'document_signed').length}
              </div>
              <div className="text-xs text-muted-foreground">Documents Signed</div>
            </div>
          </div>
        </Card>

        {/* Deal Velocity */}
        <Card className="p-5 border-border/40">
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Deal Velocity</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Time in Current Stage</p>
                <p className="text-sm font-medium">
                  {deal.deal_stage_entered_at ? formatDistanceToNow(new Date(deal.deal_stage_entered_at)) : 'Unknown'}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Total Deal Age</p>
                <p className="text-sm font-medium">
                  {deal.deal_created_at ? formatDistanceToNow(new Date(deal.deal_created_at)) : 'Unknown'}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Stage Progress</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/50 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: '60%' }} // This would be calculated based on stage position
                  />
                </div>
                <span className="text-xs text-muted-foreground">60%</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Activity Timeline */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Activity Timeline</h4>
          
          {sortedActivities.length === 0 ? (
            <Card className="p-5 border-border/40">
              <div className="text-center text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No activity recorded yet</p>
                <p className="text-xs mt-1">Activity will appear here as actions are taken</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedActivities.map((activity, index) => {
                const ActivityIcon = getActivityIcon(activity.type);
                const isRecent = new Date(activity.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                
                return (
                  <Card key={activity.id} className={`p-4 border-border/40 ${isRecent ? 'ring-1 ring-primary/20' : ''}`}>
                    <div className="flex items-start gap-4">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center">
                        <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                          <ActivityIcon className="h-4 w-4" />
                        </div>
                        {index < sortedActivities.length - 1 && (
                          <div className="w-px h-8 bg-border/40 mt-2" />
                        )}
                      </div>
                      
                      {/* Activity content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h5 className="font-medium text-sm">{activity.title}</h5>
                            <p className="text-xs text-muted-foreground">{activity.description}</p>
                          </div>
                          
                          {isRecent && (
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                              Recent
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{activity.user}</span>
                            </div>
                             <div className="flex items-center gap-1">
                               <Calendar className="h-3 w-3" />
                               <span>{activity.timestamp ? format(new Date(activity.timestamp), 'MMM d, yyyy') : 'Unknown'}</span>
                             </div>
                          </div>
                          
                          <span>{activity.timestamp ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true }) : 'Unknown'}</span>
                        </div>
                        
                        {/* Activity metadata */}
                        {activity.metadata && (
                          <div className="mt-2">
                            {activity.type === 'stage_change' && activity.metadata.from_stage && (
                              <div className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className="text-xs border-border/60">
                                  {activity.metadata.from_stage}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                  {activity.metadata.to_stage}
                                </Badge>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}