import React, { useState } from 'react';
import { Shield, Filter, Calendar, User, FileText, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';
import { useDealActivities } from '@/hooks/admin/use-deal-activities';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CompleteAuditTrailProps {
  deal: Deal;
}

export function CompleteAuditTrail({ deal }: CompleteAuditTrailProps) {
  const { data: activities = [] } = useDealActivities(deal.deal_id);
  const [filterType, setFilterType] = useState<string>('all');

  const filteredActivities = filterType === 'all' 
    ? activities 
    : activities.filter(a => a.activity_type === filterType);

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'stage_change', label: 'Stage Changes' },
    { value: 'nda_status_changed', label: 'NDA Status Changes' },
    { value: 'nda_email_sent', label: 'NDA Emails' },
    { value: 'fee_agreement_status_changed', label: 'Fee Agreement Status Changes' },
    { value: 'fee_agreement_email_sent', label: 'Fee Agreement Emails' },
    { value: 'task_created', label: 'Tasks Created' },
    { value: 'task_completed', label: 'Tasks Completed' },
    { value: 'task_assigned', label: 'Tasks Assigned' },
    { value: 'assignment_changed', label: 'Assignments Changed' },
  ];

  return (
    <div className="px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Complete Audit Trail</h2>
            <p className="text-sm text-muted-foreground">Full history of all changes and actions</p>
          </div>
        </div>

        {/* Filter */}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter activities" />
          </SelectTrigger>
          <SelectContent>
            {activityTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-muted/20 border border-border/20">
          <div className="text-2xl font-semibold text-foreground">{activities.length}</div>
          <div className="text-xs text-muted-foreground">Total Actions</div>
        </div>
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="text-2xl font-semibold text-primary">
            {activities.filter(a => a.activity_type === 'stage_change').length}
          </div>
          <div className="text-xs text-muted-foreground">Stage Changes</div>
        </div>
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-2xl font-semibold text-emerald-600">
            {activities.filter(a => ['nda_status_changed', 'fee_agreement_status_changed'].includes(a.activity_type)).length}
          </div>
          <div className="text-xs text-muted-foreground">Documents</div>
        </div>
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="text-2xl font-semibold text-blue-600">
            {activities.filter(a => a.activity_type.includes('task')).length}
          </div>
          <div className="text-xs text-muted-foreground">Task Actions</div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Activity Log
        </h3>
        
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No activities found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredActivities.map((activity) => (
              <div
                key={activity.id}
                className="p-4 rounded-lg border border-border/20 bg-card hover:bg-muted/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        activity.activity_type === 'stage_change' ? 'bg-primary/10 text-primary' :
                        ['nda_status_changed', 'fee_agreement_status_changed'].includes(activity.activity_type) ? 'bg-emerald-500/10 text-emerald-600' :
                        ['nda_email_sent', 'fee_agreement_email_sent'].includes(activity.activity_type) ? 'bg-purple-500/10 text-purple-600' :
                        activity.activity_type.includes('task') ? 'bg-blue-500/10 text-blue-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {activity.activity_type.replace('_', ' ').toUpperCase()}
                      </span>
                      <h4 className="text-sm font-medium text-foreground">{activity.title}</h4>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="pt-2 space-y-1">
                        <div className="text-xs text-muted-foreground/70">Additional Details:</div>
                        <div className="text-xs font-mono text-muted-foreground bg-muted/20 p-2 rounded">
                          {JSON.stringify(activity.metadata, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right space-y-1 flex-shrink-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>
                        {activity.admin 
                          ? `${activity.admin.first_name} ${activity.admin.last_name}` 
                          : 'System'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground/70 font-mono">
                      {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
