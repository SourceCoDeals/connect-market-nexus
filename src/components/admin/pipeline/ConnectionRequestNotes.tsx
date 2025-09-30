import React from 'react';
import { MessageSquare, FileText } from 'lucide-react';
import { ConnectionRequestDetails } from '@/hooks/admin/use-connection-request-details';

interface ConnectionRequestNotesProps {
  details: ConnectionRequestDetails;
}

export function ConnectionRequestNotes({ details }: ConnectionRequestNotesProps) {
  const hasNotes = details.user_message || details.decision_notes;

  if (!hasNotes) {
    return (
      <div className="px-8 py-6">
        <div className="text-center py-8">
          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notes available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <h3 className="text-sm font-medium text-foreground">Notes & Comments</h3>
      
      {details.user_message && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            <span>Buyer Message</span>
          </div>
          <div className="p-4 bg-muted/10 rounded-lg border border-border/20">
            <p className="text-sm text-foreground whitespace-pre-wrap">{details.user_message}</p>
          </div>
        </div>
      )}
      
      {details.decision_notes && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="w-3 h-3" />
            <span>Admin Decision Notes</span>
          </div>
          <div className="p-4 bg-muted/10 rounded-lg border border-border/20">
            <p className="text-sm text-foreground whitespace-pre-wrap">{details.decision_notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
