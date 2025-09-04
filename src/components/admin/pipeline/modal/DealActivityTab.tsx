import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDistanceToNow } from '@/lib/utils';
import { Activity, User, Clock, CheckCircle, Mail, Phone, FileText, TrendingUp } from 'lucide-react';

interface DealActivityTabProps {
  dealId: string;
}

// Mock data for now - in real implementation, we'd fetch this from an API
const mockActivities = [
  {
    id: '1',
    type: 'stage_change',
    title: 'Stage updated',
    description: 'Deal moved from Qualified to Proposal',
    user: 'John Smith',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    metadata: { from: 'Qualified', to: 'Proposal' }
  },
  {
    id: '2',
    type: 'task_completed',
    title: 'Task completed',
    description: 'Send initial proposal document',
    user: 'Sarah Johnson',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    metadata: { task: 'Send initial proposal document' }
  },
  {
    id: '3',
    type: 'email_sent',
    title: 'Email sent',
    description: 'Follow-up email sent to buyer',
    user: 'John Smith',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    metadata: { subject: 'Re: Investment Opportunity Discussion' }
  },
  {
    id: '4',
    type: 'deal_created',
    title: 'Deal created',
    description: 'Deal was created from connection request',
    user: 'System',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    metadata: { source: 'Connection Request' }
  }
];

export function DealActivityTab({ dealId }: DealActivityTabProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'stage_change':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'task_completed':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'email_sent':
        return <Mail className="h-4 w-4 text-gray-600" />;
      case 'phone_call':
        return <Phone className="h-4 w-4 text-gray-600" />;
      case 'note_added':
        return <FileText className="h-4 w-4 text-gray-600" />;
      case 'deal_created':
        return <Activity className="h-4 w-4 text-green-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'stage_change':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'task_completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'email_sent':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'phone_call':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'note_added':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'deal_created':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Activity Timeline</h2>
        <p className="text-sm text-gray-600 mt-1">
          Track all activities and changes for this deal
        </p>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4">
        {mockActivities.map((activity, index) => (
          <Card key={activity.id} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Timeline Line */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-10 h-10 bg-white border-2 border-gray-200 rounded-full">
                    {getActivityIcon(activity.type)}
                  </div>
                  {index < mockActivities.length - 1 && (
                    <div className="w-0.5 h-16 bg-gray-200 mt-2" />
                  )}
                </div>

                {/* Activity Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                    <Badge className={`${getActivityColor(activity.type)} text-xs`}>
                      {activity.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3">{activity.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {activity.user}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(activity.timestamp)} ago
                    </div>
                    <div>
                      {formatDate(activity.timestamp)}
                    </div>
                  </div>

                  {/* Activity Metadata */}
                  {activity.metadata && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      {activity.type === 'stage_change' && activity.metadata.from && activity.metadata.to && (
                        <div className="text-sm text-gray-700">
                          <strong>Stage Change:</strong> {activity.metadata.from} → {activity.metadata.to}
                        </div>
                      )}
                      {activity.type === 'task_completed' && activity.metadata.task && (
                        <div className="text-sm text-gray-700">
                          <strong>Task:</strong> {activity.metadata.task}
                        </div>
                      )}
                      {activity.type === 'email_sent' && activity.metadata.subject && (
                        <div className="text-sm text-gray-700">
                          <strong>Subject:</strong> {activity.metadata.subject}
                        </div>
                      )}
                      {activity.type === 'deal_created' && activity.metadata.source && (
                        <div className="text-sm text-gray-700">
                          <strong>Source:</strong> {activity.metadata.source}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {mockActivities.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No activity yet</h3>
            <p className="text-gray-600">Activity will appear here as the deal progresses</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}