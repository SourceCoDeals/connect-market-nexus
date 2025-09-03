import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Mail, 
  Phone, 
  Calendar, 
  MessageSquare, 
  FileText,
  User,
  Activity,
  CheckSquare,
  Send
} from 'lucide-react';
import { useDealActivities, useDealContacts, useDocumentLogs } from '@/hooks/admin/use-deal-real-data';
import { getAdminProfile } from '@/lib/admin-profiles';
import { cn } from '@/lib/utils';

interface EnhancedActivityTimelineProps {
  dealId: string;
  className?: string;
}

export function EnhancedActivityTimeline({ dealId, className }: EnhancedActivityTimelineProps) {
  const { data: activities = [], isLoading: activitiesLoading } = useDealActivities(dealId);
  const { data: contacts = [], isLoading: contactsLoading } = useDealContacts(dealId);
  const { data: documentLogs, isLoading: documentsLoading } = useDocumentLogs(dealId);

  if (activitiesLoading || contactsLoading || documentsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-sm text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  // Enhanced timeline with document activities and real admin attribution
  const timelineEntries = [
    ...activities.map(activity => ({
      id: `activity-${activity.id}`,
      type: 'activity' as const,
      title: activity.title,
      description: activity.description,
      created_at: activity.created_at,
      admin_name: getAdminNameFromId(activity.admin_id),
      activity_type: activity.activity_type,
      metadata: activity.metadata
    })),
    ...contacts.map(contact => ({
      id: `contact-${contact.id}`,
      type: 'contact' as const,
      title: getContactTitle(contact.contact_type),
      description: getContactDescription(contact.contact_details),
      created_at: contact.created_at,
      admin_name: getAdminNameFromId(contact.admin_id),
      contact_type: contact.contact_type,
      contact_details: contact.contact_details
    })),
    // Add document logs with real admin attribution
    ...(documentLogs?.nda_logs || []).map(log => ({
      id: `nda-${log.id}`,
      type: 'document' as const,
      title: `NDA ${log.action_type}`,
      description: `NDA ${log.action_type === 'sent' ? 'sent to' : log.action_type} ${log.email_sent_to || 'buyer'}`,
      created_at: log.created_at,
      admin_name: log.admin_name || 
                  (log.admin_email ? getAdminProfile(log.admin_email)?.name : null) ||
                  getAdminNameFromId(log.admin_id) ||
                  'Admin User',
      document_type: 'nda',
      action_type: log.action_type,
      email_sent_to: log.email_sent_to,
      notes: log.notes
    })),
    ...(documentLogs?.fee_agreement_logs || []).map(log => ({
      id: `fee-${log.id}`,
      type: 'document' as const,
      title: `Fee Agreement ${log.action_type}`,
      description: `Fee Agreement ${log.action_type === 'sent' ? 'sent to' : log.action_type} ${log.email_sent_to || 'buyer'}`,
      created_at: log.created_at,
      admin_name: log.admin_name || 
                  (log.admin_email ? getAdminProfile(log.admin_email)?.name : null) ||
                  getAdminNameFromId(log.admin_id) ||
                  'Admin User',
      document_type: 'fee_agreement',
      action_type: log.action_type,
      email_sent_to: log.email_sent_to,
      notes: log.notes
    }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  function getAdminNameFromId(adminId?: string): string {
    // This would ideally query the profiles table for the admin's name
    // For now, we'll use the static admin profiles as fallback
    return 'Admin User'; // Could be enhanced with a hook to get admin names by ID
  }

  function getContactTitle(contactType: string): string {
    switch (contactType) {
      case 'email': return 'Email sent';
      case 'phone': return 'Phone call';
      case 'meeting': return 'Meeting scheduled';
      case 'note': return 'Note added';
      default: return 'Contact activity';
    }
  }

  function getContactDescription(details: any): string {
    if (!details) return '';
    
    if (details.subject) return details.subject;
    if (details.note) return details.note;
    if (details.notes) return details.notes;
    if (details.duration) return `Duration: ${details.duration} minutes`;
    
    return '';
  }

  function getIcon(entry: any) {
    if (entry.type === 'contact') {
      switch (entry.contact_type) {
        case 'email': return <Mail className="w-3 h-3" />;
        case 'phone': return <Phone className="w-3 h-3" />;
        case 'meeting': return <Calendar className="w-3 h-3" />;
        case 'note': return <MessageSquare className="w-3 h-3" />;
        default: return <User className="w-3 h-3" />;
      }
    } else if (entry.type === 'document') {
      switch (entry.action_type) {
        case 'sent': return <Send className="w-3 h-3" />;
        case 'signed': return <CheckSquare className="w-3 h-3" />;
        default: return <FileText className="w-3 h-3" />;
      }
    } else {
      switch (entry.activity_type) {
        case 'document': return <FileText className="w-3 h-3" />;
        case 'stage_change': return <Activity className="w-3 h-3" />;
        default: return <Activity className="w-3 h-3" />;
      }
    }
  }

  function getIconColor(entry: any): string {
    if (entry.type === 'contact') {
      switch (entry.contact_type) {
        case 'email': return 'text-blue-600 bg-blue-50';
        case 'phone': return 'text-green-600 bg-green-50';
        case 'meeting': return 'text-purple-600 bg-purple-50';
        case 'note': return 'text-gray-600 bg-gray-50';
        default: return 'text-gray-600 bg-gray-50';
      }
    } else if (entry.type === 'document') {
      switch (entry.action_type) {
        case 'sent': return 'text-blue-600 bg-blue-50';
        case 'signed': return 'text-emerald-600 bg-emerald-50';
        case 'declined': return 'text-red-600 bg-red-50';
        default: return 'text-orange-600 bg-orange-50';
      }
    } else {
      switch (entry.activity_type) {
        case 'document': return 'text-orange-600 bg-orange-50';
        case 'stage_change': return 'text-indigo-600 bg-indigo-50';
        default: return 'text-gray-600 bg-gray-50';
      }
    }
  }

  if (timelineEntries.length === 0) {
    return (
      <div className={cn("text-center py-8 text-gray-500", className)}>
        <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No activity yet</p>
        <p className="text-xs">Activity will appear here as you work on this deal</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-medium text-gray-900">Activity Timeline</h3>
      
      <div className="space-y-4">
        {timelineEntries.map((entry, index) => (
          <div key={entry.id} className="flex gap-3">
            <div className={cn(
              "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
              getIconColor(entry)
            )}>
              {getIcon(entry)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">{entry.title}</h4>
                <span className="text-xs text-gray-500">
                  {format(new Date(entry.created_at), 'MMM dd, HH:mm')}
                </span>
              </div>
              
              {entry.description && (
                <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
              )}
              
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">by {entry.admin_name}</span>
              </div>
              
              {/* Enhanced document activity details */}
              {entry.type === 'document' && (
                <div className="mt-2 text-xs text-gray-500">
                  <span className="mr-3">
                    Document: {entry.document_type === 'nda' ? 'NDA' : 'Fee Agreement'}
                  </span>
                  {entry.email_sent_to && (
                    <span className="mr-3">To: {entry.email_sent_to}</span>
                  )}
                  {entry.notes && (
                    <div className="mt-1 text-gray-600 italic">"{entry.notes}"</div>
                  )}
                </div>
              )}
              
              {/* Show metadata for other activities */}
              {entry.type === 'activity' && 'metadata' in entry && entry.metadata && (
                <div className="mt-2 text-xs text-gray-500">
                  {typeof entry.metadata === 'object' && entry.metadata !== null && (
                    <>
                      {(entry.metadata as any).document_type && (
                        <span className="mr-3">
                          Document: {(entry.metadata as any).document_type.toUpperCase()}
                        </span>
                      )}
                      {(entry.metadata as any).status && (
                        <span>Status: {(entry.metadata as any).status}</span>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* Show contact details */}
              {entry.type === 'contact' && 'contact_details' in entry && entry.contact_details && (
                <div className="mt-2 text-xs text-gray-500">
                  {typeof entry.contact_details === 'object' && entry.contact_details !== null && (
                    <>
                      {(entry.contact_details as any).recipient && (
                        <span className="mr-3">To: {(entry.contact_details as any).recipient}</span>
                      )}
                      {(entry.contact_details as any).phone && (
                        <span className="mr-3">Phone: {(entry.contact_details as any).phone}</span>
                      )}
                      {(entry.contact_details as any).duration && (
                        <span>Duration: {(entry.contact_details as any).duration} min</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}