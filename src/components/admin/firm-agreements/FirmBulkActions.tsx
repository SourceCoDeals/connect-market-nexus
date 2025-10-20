import { useState, useEffect } from 'react';
import { Mail, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { FirmAgreement } from '@/hooks/admin/use-firm-agreements';
import { useFirmMembers } from '@/hooks/admin/use-firm-agreements';

interface FirmBulkActionsProps {
  firmId: string;
  firmName: string;
  memberCount: number;
}

export function FirmBulkActions({ firmId, firmName, memberCount }: FirmBulkActionsProps) {
  const { toast } = useToast();
  const [isNDADialogOpen, setIsNDADialogOpen] = useState(false);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const { data: members, isLoading } = useFirmMembers(firmId);

  const logEmailAction = async (type: 'nda' | 'fee', recipientEmails: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', user.id)
        .single();

      // Log to the appropriate table
      const logTable = type === 'nda' ? 'nda_logs' : 'fee_agreement_logs';
      
      // Log action for each member
      for (const email of recipientEmails) {
        await supabase.from(logTable).insert({
          user_id: user.id,
          admin_id: user.id,
          firm_id: firmId,
          action_type: 'email_client_opened',
          email_sent_to: email,
          admin_email: adminProfile?.email,
          admin_name: `${adminProfile?.first_name} ${adminProfile?.last_name}`.trim() || adminProfile?.email,
          notes: `Bulk email client opened for ${firmName} via mailto link`,
          metadata: {
            bulk_action: true,
            firm_name: firmName,
            total_recipients: recipientEmails.length,
            timestamp: new Date().toISOString()
          }
        });
      }

      console.log(`✅ Logged ${type.toUpperCase()} email action for ${recipientEmails.length} recipients at ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error logging email action:', error);
    }
  };

  const openEmailClient = (type: 'nda' | 'fee') => {
    if (!members || members.length === 0) {
      toast({
        title: 'No members found',
        description: 'This firm has no members to send emails to.',
        variant: 'destructive',
      });
      return;
    }

    const recipientEmails = members
      .map(m => m.user?.email)
      .filter((email): email is string => !!email);

    if (recipientEmails.length === 0) {
      toast({
        title: 'No email addresses',
        description: 'No valid email addresses found for firm members.',
        variant: 'destructive',
      });
      return;
    }

    const subject = type === 'nda' 
      ? `NDA Required - ${firmName}` 
      : `Fee Agreement - ${firmName}`;
    
    const body = type === 'nda'
      ? `Dear Team,\n\nPlease review and sign the attached NDA for ${firmName}.\n\nBest regards,\nSourceCo Team`
      : `Dear Team,\n\nPlease review and sign the attached Fee Agreement for ${firmName}.\n\nBest regards,\nSourceCo Team`;

    // Create mailto link with BCC for privacy
    const mailtoLink = `mailto:?bcc=${recipientEmails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open email client
    window.location.href = mailtoLink;

    // Log the action
    logEmailAction(type, recipientEmails);

    // Close dialog and show success message
    if (type === 'nda') {
      setIsNDADialogOpen(false);
    } else {
      setIsFeeDialogOpen(false);
    }

    toast({
      title: 'Email client opened',
      description: `Email draft created for ${recipientEmails.length} member${recipientEmails.length > 1 ? 's' : ''} and logged with timestamp.`,
    });
  };

  return (
    <div className="flex gap-2">
      <Dialog open={isNDADialogOpen} onOpenChange={setIsNDADialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            <Mail className="h-4 w-4 mr-2" />
            Send NDA to All
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Email Client for NDA</DialogTitle>
            <DialogDescription>
              This will open your default email client with a draft email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Opens your email client</p>
                  <p className="text-xs text-muted-foreground">
                    A draft email will be created with all <strong>{memberCount}</strong> member{memberCount !== 1 ? 's' : ''} of <strong>{firmName}</strong> in BCC.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    ✓ Action will be logged with timestamp<br />
                    ✓ Members' privacy protected (BCC)<br />
                    ✓ You can customize the email before sending
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsNDADialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => openEmailClient('nda')}>
                <Mail className="h-4 w-4 mr-2" />
                Open Email Client
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            <Mail className="h-4 w-4 mr-2" />
            Send Fee Agreement to All
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Email Client for Fee Agreement</DialogTitle>
            <DialogDescription>
              This will open your default email client with a draft email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Opens your email client</p>
                  <p className="text-xs text-muted-foreground">
                    A draft email will be created with all <strong>{memberCount}</strong> member{memberCount !== 1 ? 's' : ''} of <strong>{firmName}</strong> in BCC.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    ✓ Action will be logged with timestamp<br />
                    ✓ Members' privacy protected (BCC)<br />
                    ✓ You can customize the email before sending
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsFeeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => openEmailClient('fee')}>
                <Mail className="h-4 w-4 mr-2" />
                Open Email Client
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
