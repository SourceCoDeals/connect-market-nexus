import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFirmMembers } from '@/hooks/admin/use-firm-agreements';

interface FirmBulkActionsProps {
  firmId: string;
  firmName: string;
  memberCount: number;
}

export function FirmBulkActions({ firmId, firmName, memberCount }: FirmBulkActionsProps) {
  const { toast } = useToast();
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
      ? `NDA Agreement Required | ${firmName}` 
      : `Fee Agreement Required | ${firmName}`;
    
    const body = type === 'nda'
      ? `Dear ${firmName} Team,\n\nI hope this message finds you well.\n\nAs part of our engagement process, we require a signed Non-Disclosure Agreement (NDA) before we can proceed with sharing confidential business information.\n\nPlease review and sign the attached NDA at your earliest convenience. Once signed, please return it to us so we can move forward with the next steps.\n\nIf you have any questions or need clarification on any terms, please don't hesitate to reach out.\n\nThank you for your cooperation.\n\nBest regards,\nSourceCo Team`
      : `Dear ${firmName} Team,\n\nI hope this message finds you well.\n\nAs discussed, please find attached our Fee Agreement for your review and signature.\n\nThis agreement outlines the terms of our engagement and the associated fees for our services. Please review the document carefully and sign it at your earliest convenience.\n\nOnce signed, please return a copy to us. We're excited to move forward with our partnership.\n\nIf you have any questions about the terms or would like to discuss any aspect of the agreement, please feel free to contact us.\n\nThank you for choosing SourceCo.\n\nBest regards,\nSourceCo Team`;

    // Create mailto link with BCC for privacy
    const mailtoLink = `mailto:?bcc=${recipientEmails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open email client
    window.location.href = mailtoLink;

    // Log the action
    logEmailAction(type, recipientEmails);

    toast({
      title: 'Email client opened',
      description: `Email draft created for ${recipientEmails.length} member${recipientEmails.length > 1 ? 's' : ''} and logged with timestamp.`,
    });
  };

  return (
    <div className="flex gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        disabled={isLoading}
        onClick={() => openEmailClient('nda')}
      >
        <Mail className="h-4 w-4 mr-2" />
        Send NDA to All
      </Button>

      <Button 
        variant="outline" 
        size="sm" 
        disabled={isLoading}
        onClick={() => openEmailClient('fee')}
      >
        <Mail className="h-4 w-4 mr-2" />
        Send Fee Agreement to All
      </Button>
    </div>
  );
}
