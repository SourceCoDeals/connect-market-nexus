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
      
      return adminProfile;
    } catch (error) {
      console.error('Error logging email action:', error);
      return null;
    }
  };

  const openEmailClient = async (type: 'nda' | 'fee') => {
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

    // Get admin profile for signature
    const adminProfile = await logEmailAction(type, recipientEmails);
    const adminName = adminProfile?.first_name || 'SourceCo Team';

    const subject = type === 'nda' 
      ? `NDA Required` 
      : `Fee Agreement`;
    
    const body = type === 'nda'
      ? `Dear ${firmName} Team,\n\nWhen you get a chance, please review and sign the attached NDA.\n\nThanks!\n\nBest regards,\n${adminName}`
      : `Dear ${firmName} Team,\n\nWhen you get a chance, please review and sign the attached fee agreement.\n\nThanks!\n\nBest regards,\n${adminName}`;

    // Create mailto link with BCC for privacy
    const mailtoLink = `mailto:?bcc=${recipientEmails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open email client
    window.location.href = mailtoLink;

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
