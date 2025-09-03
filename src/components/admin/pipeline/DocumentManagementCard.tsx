import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  FileText, 
  Send, 
  CheckSquare, 
  X, 
  RefreshCw,
  Eye,
  Calendar,
  User
} from 'lucide-react';
import { useUpdateDocumentStatus } from '@/hooks/admin/use-deal-documents';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DocumentManagementCardProps {
  dealId: string;
  contactEmail?: string;
  contactName?: string;
  ndaStatus: string;
  feeAgreementStatus: string;
  className?: string;
}

export function DocumentManagementCard({ 
  dealId, 
  contactEmail, 
  contactName,
  ndaStatus, 
  feeAgreementStatus,
  className 
}: DocumentManagementCardProps) {
  const [selectedDocument, setSelectedDocument] = useState<'nda' | 'fee_agreement' | null>(null);
  const [actionType, setActionType] = useState<'send' | 'mark_signed' | 'mark_declined' | 'resend' | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(contactEmail || '');
  const [notes, setNotes] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const updateDocument = useUpdateDocumentStatus();

  const getDocumentStatusBadge = (status: string) => {
    switch (status) {
      case 'signed': return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'sent': return 'bg-blue-50 text-blue-600 border-blue-200/60';
      case 'declined': return 'bg-red-50 text-red-700 border-red-200/60';
      default: return 'bg-gray-50 text-gray-500 border-gray-200/60';
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed': return <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />;
      case 'sent': return <Send className="w-3.5 h-3.5 text-blue-600" />;
      case 'declined': return <X className="w-3.5 h-3.5 text-red-600" />;
      default: return <FileText className="w-3.5 h-3.5 text-gray-600" />;
    }
  };

  const getAvailableActions = (status: string) => {
    const actions = [];
    
    if (status === 'not_sent' || status === 'declined') {
      actions.push({ type: 'send', label: 'Send Document', icon: Send });
    }
    
    if (status === 'sent') {
      actions.push({ type: 'resend', label: 'Resend', icon: RefreshCw });
      actions.push({ type: 'mark_signed', label: 'Mark Signed', icon: CheckSquare });
      actions.push({ type: 'mark_declined', label: 'Mark Declined', icon: X });
    }
    
    if (status === 'signed' || status === 'declined') {
      actions.push({ type: 'resend', label: 'Resend', icon: RefreshCw });
    }

    return actions;
  };

  const handleAction = (documentType: 'nda' | 'fee_agreement', action: string) => {
    setSelectedDocument(documentType);
    setActionType(action as any);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedDocument || !actionType) return;

    try {
      await updateDocument.mutateAsync({
        dealId,
        documentType: selectedDocument,
        action: actionType,
        recipientEmail: actionType === 'send' || actionType === 'resend' ? recipientEmail : undefined,
        notes
      });
      
      setIsDialogOpen(false);
      setNotes('');
      setActionType(null);
      setSelectedDocument(null);
    } catch (error) {
      console.error('Failed to update document:', error);
    }
  };

  const getActionTitle = () => {
    if (!selectedDocument || !actionType) return '';
    
    const docLabel = selectedDocument === 'nda' ? 'NDA' : 'Fee Agreement';
    const actionLabels = {
      send: 'Send',
      resend: 'Resend',
      mark_signed: 'Mark as Signed',
      mark_declined: 'Mark as Declined'
    };
    
    return `${actionLabels[actionType]} ${docLabel}`;
  };

  return (
    <>
      <Card className={cn("border-gray-200/60 shadow-sm bg-white/60 rounded-lg", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600" />
            Document Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* NDA Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 px-3 border border-gray-200/60 rounded-md bg-gray-50/30">
              <div className="flex items-center gap-3">
                {getStatusIcon(ndaStatus)}
                <div>
                  <p className="text-sm font-medium text-gray-900">Non-Disclosure Agreement</p>
                  <p className="text-xs text-gray-500">Required for deal details</p>
                </div>
              </div>
              <Badge className={cn("px-2 py-0.5 text-xs border rounded-md font-medium", getDocumentStatusBadge(ndaStatus))}>
                {getStatusLabel(ndaStatus)}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {getAvailableActions(ndaStatus).map((action) => (
                <Button
                  key={action.type}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('nda', action.type)}
                  className="text-xs h-8"
                >
                  <action.icon className="w-3 h-3 mr-1.5" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200/40 pt-4">
            {/* Fee Agreement Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 px-3 border border-gray-200/60 rounded-md bg-gray-50/30">
                <div className="flex items-center gap-3">
                  {getStatusIcon(feeAgreementStatus)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">Fee Agreement</p>
                    <p className="text-xs text-gray-500">Commission structure</p>
                  </div>
                </div>
                <Badge className={cn("px-2 py-0.5 text-xs border rounded-md font-medium", getDocumentStatusBadge(feeAgreementStatus))}>
                  {getStatusLabel(feeAgreementStatus)}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {getAvailableActions(feeAgreementStatus).map((action) => (
                  <Button
                    key={action.type}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('fee_agreement', action.type)}
                    className="text-xs h-8"
                  >
                    <action.icon className="w-3 h-3 mr-1.5" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Document History/Info */}
          {(ndaStatus !== 'not_sent' || feeAgreementStatus !== 'not_sent') && (
            <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-200/30">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3 h-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Document Activity</span>
              </div>
              <div className="space-y-1">
                {ndaStatus !== 'not_sent' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">NDA {getStatusLabel(ndaStatus).toLowerCase()}</span>
                    <span className="text-gray-500">{format(new Date(), 'MMM dd')}</span>
                  </div>
                )}
                {feeAgreementStatus !== 'not_sent' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Fee Agreement {getStatusLabel(feeAgreementStatus).toLowerCase()}</span>
                    <span className="text-gray-500">{format(new Date(), 'MMM dd')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{getActionTitle()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(actionType === 'send' || actionType === 'resend') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Recipient Email</label>
                <Input
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Enter recipient email"
                  type="email"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this action..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={updateDocument.isPending || ((actionType === 'send' || actionType === 'resend') && !recipientEmail)}
              >
                {updateDocument.isPending ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}