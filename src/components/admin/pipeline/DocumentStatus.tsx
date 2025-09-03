import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Shield, 
  Send, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  RotateCcw,
  FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentLogs } from '@/hooks/admin/use-deal-real-data';
import { useUpdateDocumentStatus } from '@/hooks/admin/use-deal-documents';
import { useToast } from '@/hooks/use-toast';
import { MinimalDocumentToggle } from './MinimalDocumentToggle';

interface DocumentStatusProps {
  dealId?: string;
  contactEmail?: string;
  contactName?: string;
  ndaStatus: string;
  feeAgreementStatus: string;
  className?: string;
}

export function DocumentStatus({
  dealId,
  contactEmail,
  contactName,
  ndaStatus,
  feeAgreementStatus,
  className
}: DocumentStatusProps) {
  const [selectedDocument, setSelectedDocument] = useState<'nda' | 'fee_agreement' | null>(null);
  const [selectedAction, setSelectedAction] = useState<'send' | 'resend' | 'mark_signed' | 'mark_declined' | ''>('');
  const [recipientEmail, setRecipientEmail] = useState(contactEmail || '');
  const [notes, setNotes] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: documentLogs } = useDocumentLogs(dealId);
  const updateDocumentStatus = useUpdateDocumentStatus();
  const { toast } = useToast();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
      case 'sent':
        return <Clock className="w-3.5 h-3.5 text-blue-600" />;
      case 'declined':
        return <XCircle className="w-3.5 h-3.5 text-red-600" />;
      default:
        return <AlertCircle className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'signed': return 'Signed';
      case 'sent': return 'Sent';
      case 'declined': return 'Declined';
      default: return 'Not Sent';
    }
  };

  const getAvailableActions = (status: string): string[] => {
    switch (status) {
      case 'not_sent':
        return ['send'];
      case 'sent':
        return ['resend', 'mark_signed', 'mark_declined'];
      case 'signed':
        return ['resend'];
      case 'declined':
        return ['resend'];
      default:
        return ['send'];
    }
  };

  const getRecentDocumentActivity = (documentType: 'nda' | 'fee_agreement') => {
    if (!documentLogs) return null;
    
    const logs = documentType === 'nda' ? documentLogs.nda_logs : documentLogs.fee_agreement_logs;
    if (!logs || logs.length === 0) return null;
    
    const recent = logs[0];
    return {
      admin_name: recent.admin_name || 'System',
      timeAgo: recent.created_at ? new Date(recent.created_at).toLocaleDateString() : 'Unknown'
    };
  };

  const ndaActivity = getRecentDocumentActivity('nda');
  const feeActivity = getRecentDocumentActivity('fee_agreement');

  const handleAction = (documentType: 'nda' | 'fee_agreement', action: 'send' | 'resend' | 'mark_signed' | 'mark_declined') => {
    setSelectedDocument(documentType);
    setSelectedAction(action);
    setRecipientEmail(contactEmail || '');
    setNotes('');
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!dealId || !selectedDocument || !selectedAction) return;

    try {
      await updateDocumentStatus.mutateAsync({
        dealId,
        documentType: selectedDocument,
        action: selectedAction,
        recipientEmail: recipientEmail || undefined,
        notes: notes || undefined
      });

      setIsDialogOpen(false);
      toast({
        title: "Document Updated",
        description: `${selectedDocument === 'nda' ? 'NDA' : 'Fee Agreement'} status updated successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update document status.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
          <FileCheck className="w-4 h-4 text-slate-600" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Documents</h3>
      </div>

      <div className="space-y-3">
        {/* NDA Toggle */}
        <MinimalDocumentToggle
          type="nda"
          status={ndaStatus}
          onStatusChange={(status) => {
            if (status === 'signed') {
              handleAction('nda', 'mark_signed');
            } else {
              // Handle other status changes if needed
            }
          }}
          lastActivity={ndaActivity}
        />

        {/* Fee Agreement Toggle */}
        <MinimalDocumentToggle
          type="fee_agreement"
          status={feeAgreementStatus}
          onStatusChange={(status) => {
            if (status === 'signed') {
              handleAction('fee_agreement', 'mark_signed');
            } else {
              // Handle other status changes if needed
            }
          }}
          lastActivity={feeActivity}
        />
      </div>

      {/* Quick Actions for Document Management */}
      <div className="flex gap-2 pt-2">
        {getAvailableActions(ndaStatus).includes('send') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('nda', 'send')}
            className="text-xs h-8 px-3"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send NDA
          </Button>
        )}
        {getAvailableActions(feeAgreementStatus).includes('send') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('fee_agreement', 'send')}
            className="text-xs h-8 px-3"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send Fee Agreement
          </Button>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedAction === 'send' && 'Send Document'}
              {selectedAction === 'resend' && 'Resend Document'}  
              {selectedAction === 'mark_signed' && 'Mark as Signed'}
              {selectedAction === 'mark_declined' && 'Mark as Declined'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {(selectedAction === 'send' || selectedAction === 'resend') && (
              <div className="space-y-2">
                <Label htmlFor="email">Recipient Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any relevant notes..."
                className="min-h-[80px]"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={updateDocumentStatus.isPending || (!recipientEmail && (selectedAction === 'send' || selectedAction === 'resend'))}
              >
                {updateDocumentStatus.isPending ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}