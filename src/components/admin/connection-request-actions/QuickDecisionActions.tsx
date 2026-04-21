/**
 * QuickDecisionActions.tsx
 *
 * Inline decision strip shown in the collapsed connection request row.
 * Renders Accept / Decline / On Hold buttons for pending requests
 * without requiring the row to be expanded.
 *
 * For marketplace users, uses useConnectionRequestActions + ConnectionRequestEmailDialog.
 * For lead-only requests, uses useUpdateConnectionRequestStatus directly + same email dialog.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AdminConnectionRequest } from '@/types/admin';
import { ConnectionRequestEmailDialog } from '@/components/admin/ConnectionRequestEmailDialog';
import { useConnectionRequestActions } from './useConnectionRequestActions';
import { useUpdateConnectionRequestStatus } from '@/hooks/admin/use-connection-request-status';
import { useSendMessage } from '@/hooks/use-connection-messages';
import { supabase } from '@/integrations/supabase/client';

interface QuickDecisionActionsProps {
  request: AdminConnectionRequest;
}

export function QuickDecisionActions({ request }: QuickDecisionActionsProps) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailActionType, setEmailActionType] = useState<'approve' | 'reject' | null>(null);

  const hasUser = !!request.user;

  // Always call hooks unconditionally (Rules of Hooks)
  // For lead-only — lighter-weight direct mutation
  const updateStatus = useUpdateConnectionRequestStatus();
  const sendMessage = useSendMessage();

  // Placeholder user for the hook when no real user exists
  const placeholderUser =
    request.user ??
    ({
      id: '',
      email: request.lead_email || '',
      first_name: request.lead_name || '',
      last_name: '',
    } as any);

  const userActions = useConnectionRequestActions({
    user: placeholderUser,
    listing: request.listing ?? undefined,
    requestId: request.id,
  });

  const isLoading = hasUser
    ? userActions.updateStatus.isPending || userActions.isRejecting || false
    : updateStatus.isPending;

  const openEmailDialog = (action: 'approve' | 'reject') => {
    setEmailActionType(action);
    setEmailDialogOpen(true);
  };

  const handleOnHold = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasUser) {
      userActions.handleOnHold();
    } else {
      updateStatus.mutate({ requestId: request.id, status: 'on_hold' });
    }
  };

  // Build a minimal AdminConnectionRequest for the email dialog
  const dialogRequest: AdminConnectionRequest = {
    ...request,
    status:
      request.status === 'converted'
        ? 'approved'
        : request.status === 'notified' || request.status === 'reviewed'
          ? 'pending'
          : request.status,
  } as AdminConnectionRequest;

  const handleEmailDialogConfirm = async (
    comment: string,
    senderEmail: string,
    customBody?: string,
  ) => {
    if (hasUser) {
      // Marketplace user flow
      if (emailActionType === 'approve') {
        await userActions.handleAccept(senderEmail, customBody, comment);
      } else if (emailActionType === 'reject') {
        await userActions.handleReject(senderEmail, customBody, comment);
      }
    } else {
      // Lead-only flow — mirrors WebflowLeadDetail logic
      const { DEAL_OWNER_SENDERS } = await import('@/lib/admin-profiles');
      const senderInfo = senderEmail
        ? DEAL_OWNER_SENDERS.find((s) => s.email === senderEmail)
        : null;

      if (emailActionType === 'approve') {
        try {
          await updateStatus.mutateAsync({
            requestId: request.id,
            status: 'approved',
            notes: comment || undefined,
          });
        } catch {
          return;
        }

        sendMessage
          .mutateAsync({
            connection_request_id: request.id,
            body: `Request for ${request.listing?.title || 'this deal'} has been approved.`,
            sender_role: 'admin',
            message_type: 'decision',
          })
          .catch(() => {});

        const buyerEmail = request.lead_email || request.user?.email;
        const buyerName = request.lead_name || '';
        if (buyerEmail) {
          supabase.functions
            .invoke('send-connection-notification', {
              body: {
                type: 'approval_notification',
                recipientEmail: buyerEmail,
                recipientName: buyerName || buyerEmail,
                requesterName: buyerName || buyerEmail,
                requesterEmail: buyerEmail,
                listingTitle: request.listing?.title || 'General Inquiry',
                listingId: request.listing?.id || undefined,
                requestId: request.id,
                ...(senderEmail && senderInfo
                  ? {
                      senderEmail: senderInfo.email,
                      senderName: senderInfo.name,
                      replyTo: senderInfo.email,
                    }
                  : {}),
                ...(customBody ? { customBodyText: customBody } : {}),
              },
            })
            .catch(() => {});
        }
      } else if (emailActionType === 'reject') {
        try {
          await updateStatus.mutateAsync({
            requestId: request.id,
            status: 'rejected',
            notes: comment || undefined,
          });
        } catch {
          return;
        }

        sendMessage
          .mutateAsync({
            connection_request_id: request.id,
            body: comment || 'Request declined.',
            sender_role: 'admin',
            message_type: 'decision',
          })
          .catch(() => {});

        const buyerEmail = request.lead_email || request.user?.email;
        const buyerName = request.lead_name || '';
        if (buyerEmail) {
          supabase.functions
            .invoke('notify-buyer-rejection', {
              body: {
                connectionRequestId: request.id,
                buyerEmail,
                buyerName: buyerName || buyerEmail,
                companyName: request.listing?.title || 'the listing',
                ...(senderEmail && senderInfo
                  ? {
                      senderEmail: senderInfo.email,
                      senderName: senderInfo.name,
                      replyTo: senderInfo.email,
                    }
                  : {}),
                ...(customBody ? { customBodyText: customBody } : {}),
              },
            })
            .catch(() => {});
        }
      }
    }
    setEmailDialogOpen(false);
    setEmailActionType(null);
  };

  return (
    <>
      <div
        className="flex items-center gap-3 pt-3 border-t border-border/40"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mr-auto">
          Decision Required
        </span>
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openEmailDialog('approve');
          }}
          disabled={isLoading}
          className="bg-foreground text-background hover:bg-foreground/90 h-7 px-3 text-xs font-medium rounded-full"
        >
          Accept
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openEmailDialog('reject');
          }}
          disabled={isLoading}
          className="border-border text-foreground h-7 px-3 text-xs font-medium rounded-full"
        >
          Decline
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOnHold}
          disabled={isLoading}
          className="border-border text-muted-foreground h-7 px-3 text-xs font-medium rounded-full"
        >
          On Hold
        </Button>
      </div>

      <ConnectionRequestEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => {
          setEmailDialogOpen(false);
          setEmailActionType(null);
        }}
        onConfirm={handleEmailDialogConfirm}
        selectedRequest={dialogRequest}
        actionType={emailActionType}
        isLoading={isLoading}
      />
    </>
  );
}
