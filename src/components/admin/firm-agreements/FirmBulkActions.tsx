import { useState } from 'react';
import { Mail, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { FirmAgreement } from '@/hooks/admin/use-firm-agreements';

interface FirmBulkActionsProps {
  firmId: string;
  firmName: string;
  memberCount: number;
}

export function FirmBulkActions({ firmId, firmName, memberCount }: FirmBulkActionsProps) {
  const { toast } = useToast();
  const [isSendingNDA, setIsSendingNDA] = useState(false);
  const [isSendingFee, setIsSendingFee] = useState(false);
  const [isNDADialogOpen, setIsNDADialogOpen] = useState(false);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);

  const sendBulkEmail = async (type: 'nda' | 'fee') => {
    const isFee = type === 'fee';
    const setLoading = isFee ? setIsSendingFee : setIsSendingNDA;
    const setDialogOpen = isFee ? setIsFeeDialogOpen : setIsNDADialogOpen;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (!adminProfile) throw new Error('Admin profile not found');

      const functionName = isFee ? 'send-fee-agreement-email' : 'send-nda-email';
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          firmId,
          sendToAllMembers: true,
          userEmail: 'dummy@email.com', // Required by interface but not used for bulk
          adminId: user.id,
          adminEmail: adminProfile.email,
          adminName: `${adminProfile.first_name} ${adminProfile.last_name}`.trim() || adminProfile.email,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Success',
          description: `${isFee ? 'Fee agreement' : 'NDA'} sent to ${data.successCount}/${data.totalRecipients} firm members`,
        });
        setDialogOpen(false);
      } else {
        throw new Error(data?.message || 'Failed to send emails');
      }
    } catch (error: any) {
      console.error(`Error sending bulk ${type}:`, error);
      toast({
        title: 'Error',
        description: error.message || `Failed to send ${isFee ? 'fee agreements' : 'NDAs'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog open={isNDADialogOpen} onOpenChange={setIsNDADialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Send NDA to All
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send NDA to All Firm Members</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will send the NDA email to all <strong>{memberCount}</strong> members of <strong>{firmName}</strong>.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsNDADialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => sendBulkEmail('nda')} disabled={isSendingNDA}>
                {isSendingNDA ? 'Sending...' : 'Send to All Members'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Send Fee Agreement to All
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Fee Agreement to All Firm Members</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will send the fee agreement email to all <strong>{memberCount}</strong> members of <strong>{firmName}</strong>.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsFeeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => sendBulkEmail('fee')} disabled={isSendingFee}>
                {isSendingFee ? 'Sending...' : 'Send to All Members'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
