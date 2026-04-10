import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, XCircle, Mail, AlertTriangle, Pencil, RotateCcw } from 'lucide-react';
import { AdminConnectionRequest } from '@/types/admin';
import { DEAL_OWNER_SENDERS } from '@/lib/admin-profiles';
import { useAuth } from '@/contexts/AuthContext';

interface ConnectionRequestEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string, senderEmail: string, customBody?: string) => Promise<void>;
  selectedRequest: AdminConnectionRequest | null;
  actionType: 'approve' | 'reject' | null;
  isLoading: boolean;
}

export function ConnectionRequestEmailDialog({
  isOpen,
  onClose,
  onConfirm,
  selectedRequest,
  actionType,
  isLoading,
}: ConnectionRequestEmailDialogProps) {
  const { user: authUser } = useAuth();
  const [adminComment, setAdminComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState('');

  const defaultSender = useMemo(() => {
    if (authUser?.email) {
      const match = DEAL_OWNER_SENDERS.find(s => s.email === authUser.email);
      if (match) return match.email;
    }
    return DEAL_OWNER_SENDERS[0].email;
  }, [authUser?.email]);

  const [senderEmail, setSenderEmail] = useState(defaultSender);

  useEffect(() => {
    if (isOpen) {
      setSenderEmail(defaultSender);
      setIsEditing(false);
      setEditedBody('');
    }
  }, [isOpen, defaultSender]);

  const userName = selectedRequest
    ? (selectedRequest.user
      ? `${selectedRequest.user.first_name || ''} ${selectedRequest.user.last_name || ''}`.trim()
      : selectedRequest.lead_name || 'Unknown')
    : '';

  const userEmail = selectedRequest?.user?.email || selectedRequest?.lead_email || '';
  const userCompany = selectedRequest?.user?.company || selectedRequest?.lead_company || '';
  const listingTitle = selectedRequest?.listing?.title || 'Untitled Listing';

  const isApproval = actionType === 'approve';
  const selectedSender = DEAL_OWNER_SENDERS.find(s => s.email === senderEmail) || DEAL_OWNER_SENDERS[0];

  const defaultBody = useMemo(() => {
    if (!selectedRequest) return '';
    if (isApproval) {
      return `Your request for ${listingTitle} has been approved.\n\nYou now have access to additional deal materials, detailed company information - including the real company name - and supporting documents. ${selectedSender.name} will be in touch shortly with next steps.\n\nWhat to expect:\n- Access to the full deal profile, data room, and supporting materials\n- ${selectedSender.name} from our team will reach out to coordinate next steps\n- Message us directly on the platform or reply to this email\n\nThis is an exclusive opportunity. We work with a small number of buyers per deal. Move at your own pace, but do not sit on it.`;
    }
    return `Thank you for your interest in ${listingTitle}.\n\nAfter reviewing your profile against this specific opportunity, we have decided not to move forward with an introduction at this time. We limit introductions to a small number of buyers per deal to ensure strong alignment on both sides.\n\nYour interest has been noted. If the situation changes, we will reach out directly.\n\nIn the meantime, continue browsing the pipeline. New deals are added regularly and your next match may already be live.`;
  }, [selectedRequest, isApproval, listingTitle, selectedSender.name]);

  const handleClose = () => {
    setAdminComment('');
    setError(null);
    setIsEditing(false);
    setEditedBody('');
    onClose();
  };

  const handleConfirm = async () => {
    try {
      setError(null);
      const customBody = isEditing && editedBody.trim() !== defaultBody.trim() ? editedBody.trim() : undefined;
      await onConfirm(adminComment, senderEmail, customBody);
      setAdminComment('');
      setIsEditing(false);
      setEditedBody('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleStartEditing = () => {
    setEditedBody(defaultBody);
    setIsEditing(true);
  };

  const handleResetBody = () => {
    setEditedBody(defaultBody);
  };

  if (!selectedRequest) return null;

  const subject = isApproval
    ? `Request approved: ${listingTitle}`
    : `Regarding your interest in ${listingTitle}`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-8 pt-8 pb-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {isApproval ? 'Approve Request' : 'Decline Request'}
            </DialogTitle>
            <p className="text-sm" style={{ color: '#6B6B6B' }}>
              {isApproval
                ? 'Review the email below, then approve and send.'
                : 'Review the rejection email below, then confirm.'}
            </p>
          </DialogHeader>
        </div>

        {error && (
          <div className="mx-8 flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="px-8 space-y-6">
          {/* Recipient + Deal */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              <p className="text-xs" style={{ color: '#9A9A9A' }}>{userEmail}</p>
              {userCompany && (
                <p className="text-xs" style={{ color: '#9A9A9A' }}>{userCompany}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium" style={{ color: '#6B6B6B' }}>Deal</p>
              <p className="text-sm font-medium text-foreground">{listingTitle}</p>
            </div>
          </div>

          {/* Sender selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#6B6B6B' }}>Send from</label>
            <Select value={senderEmail} onValueChange={setSenderEmail}>
              <SelectTrigger className="text-sm h-10 bg-white border-[hsl(var(--border))]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_OWNER_SENDERS.map((sender) => (
                  <SelectItem key={sender.email} value={sender.email}>
                    <span className="font-medium">{sender.name}</span>
                    <span className="ml-1.5" style={{ color: '#9A9A9A' }}>({sender.email})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Email preview card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#6B6B6B' }}>Email preview</p>
              {!isEditing ? (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={handleStartEditing}>
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={handleResetBody}>
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              )}
            </div>

            <div className="rounded-lg border border-[#E5E5E5] bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Email header */}
              <div className="px-5 py-4 space-y-1.5 border-b border-[#E5E5E5]" style={{ backgroundColor: '#FAFAFA' }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide w-12 shrink-0" style={{ color: '#9A9A9A' }}>From</span>
                  <span className="text-xs text-foreground font-medium">{selectedSender.name} &lt;{selectedSender.email}&gt;</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide w-12 shrink-0" style={{ color: '#9A9A9A' }}>To</span>
                  <span className="text-xs text-foreground">{userName} &lt;{userEmail}&gt;</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide w-12 shrink-0" style={{ color: '#9A9A9A' }}>Subject</span>
                  <span className="text-xs text-foreground font-medium">{subject}</span>
                </div>
              </div>

              {/* Email body */}
              <div className="px-5 py-5">
                {isEditing ? (
                  <Textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="min-h-[240px] text-[13px] leading-relaxed font-normal resize-y border-[hsl(var(--border))] bg-white focus:border-foreground focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                ) : isApproval ? (
                  <div className="space-y-4 text-[13px] text-foreground leading-relaxed">
                    <p>Your request for <strong>{listingTitle}</strong> has been approved.</p>
                    <p style={{ color: '#4A4A4A' }}>
                      You now have access to additional deal materials, detailed company information - including the real company name - and supporting documents. {selectedSender.name} will be in touch shortly with next steps.
                    </p>
                    <div>
                      <p className="font-medium mb-2">What to expect</p>
                      <ul className="space-y-1.5 pl-5" style={{ color: '#4A4A4A' }}>
                        <li className="list-disc">Access to the full deal profile, data room, and supporting materials</li>
                        <li className="list-disc">{selectedSender.name} from our team will reach out to coordinate next steps</li>
                        <li className="list-disc">Message us directly on the platform or reply to this email</li>
                      </ul>
                    </div>
                    <p style={{ color: '#6B6B6B' }}>
                      This is an exclusive opportunity. We work with a small number of buyers per deal. Move at your own pace, but do not sit on it.
                    </p>
                    <div className="pt-1">
                      <span className="inline-block text-xs font-semibold px-5 py-2.5 rounded-md" style={{ backgroundColor: '#0E101A', color: '#ffffff' }}>
                        View Deal
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-[13px] text-foreground leading-relaxed">
                    <p>Thank you for your interest in <strong>{listingTitle}</strong>.</p>
                    <p style={{ color: '#4A4A4A' }}>
                      After reviewing your profile against this specific opportunity, we have decided not to move forward with an introduction at this time. We limit introductions to a small number of buyers per deal to ensure strong alignment on both sides.
                    </p>
                    <p style={{ color: '#4A4A4A' }}>
                      Your interest has been noted. If the situation changes, we will reach out directly.
                    </p>
                    <p style={{ color: '#4A4A4A' }}>
                      In the meantime, continue browsing the pipeline. New deals are added regularly and your next match may already be live.
                    </p>
                    <p className="pt-2" style={{ color: '#9A9A9A' }}>The SourceCo Team</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Admin note */}
          <div className="space-y-2">
            <label htmlFor="admin-comment" className="text-xs font-medium uppercase tracking-wide" style={{ color: '#6B6B6B' }}>
              {isApproval ? 'Internal note (optional)' : 'Rejection reason (optional)'}
            </label>
            <Textarea
              id="admin-comment"
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder={
                isApproval
                  ? 'Add any internal notes about this approval...'
                  : 'Provide a reason for rejection...'
              }
              className="min-h-[72px] text-sm resize-none bg-white border-[hsl(var(--border))] focus:border-foreground focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-8 pb-8 pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto border-[hsl(var(--border))] hover:bg-muted/50"
            style={{ color: '#6B6B6B' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto font-medium"
            style={
              isApproval
                ? { backgroundColor: '#0E101A', color: '#ffffff' }
                : { backgroundColor: '#DC2626', color: '#ffffff' }
            }
          >
            {isLoading ? (
              <>
                <Mail className="h-4 w-4 mr-2 animate-spin" />
                {isApproval ? 'Approving...' : 'Declining...'}
              </>
            ) : (
              <>
                {isApproval ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {isApproval ? 'Approve & Send Email' : 'Decline & Send Email'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
