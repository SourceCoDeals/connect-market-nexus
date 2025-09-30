import React from 'react';
import { FileCheck, Mail, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ConnectionRequestDetails } from '@/hooks/admin/use-connection-request-details';

interface DocumentHistoryProps {
  details: ConnectionRequestDetails;
}

export function DocumentHistory({ details }: DocumentHistoryProps) {
  const getAdminName = (admin?: { first_name: string; last_name: string; email: string }) => {
    if (!admin) return 'Unknown Admin';
    return `${admin.first_name} ${admin.last_name}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  };

  const events = [
    {
      type: 'NDA Email Sent',
      date: details.lead_nda_email_sent_at,
      admin: details.nda_email_sent_by_admin,
      status: details.lead_nda_email_sent,
      icon: Mail,
      color: 'text-blue-600'
    },
    {
      type: 'NDA Signed',
      date: details.lead_nda_signed_at,
      admin: details.nda_signed_by_admin,
      status: details.lead_nda_signed,
      icon: FileCheck,
      color: 'text-emerald-600'
    },
    {
      type: 'Fee Agreement Email Sent',
      date: details.lead_fee_agreement_email_sent_at,
      admin: details.fee_email_sent_by_admin,
      status: details.lead_fee_agreement_email_sent,
      icon: Mail,
      color: 'text-blue-600'
    },
    {
      type: 'Fee Agreement Signed',
      date: details.lead_fee_agreement_signed_at,
      admin: details.fee_signed_by_admin,
      status: details.lead_fee_agreement_signed,
      icon: FileCheck,
      color: 'text-emerald-600'
    }
  ].filter(event => event.status && event.date);

  if (events.length === 0) {
    return (
      <div className="px-8 py-6">
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No document history yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Document History</h3>
      
      <div className="space-y-3">
        {events.map((event, index) => {
          const Icon = event.icon;
          return (
            <div key={index} className="flex items-start gap-3 py-3 border-b border-border/20 last:border-0">
              <div className={`p-2 rounded-lg bg-muted/20 ${event.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{event.type}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{getAdminName(event.admin)}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground/70 font-mono whitespace-nowrap">
                    {formatDate(event.date)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
