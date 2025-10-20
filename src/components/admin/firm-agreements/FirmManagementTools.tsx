import { useState } from 'react';
import { Settings, GitMerge, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFirmAgreements } from '@/hooks/admin/use-firm-agreements';
import { useQueryClient } from '@tanstack/react-query';

export function FirmManagementTools() {
  const { data: firms } = useFirmAgreements();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [sourceFirmId, setSourceFirmId] = useState('');
  const [targetFirmId, setTargetFirmId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [selectedFirmId, setSelectedFirmId] = useState('');

  const handleMergeFirms = async () => {
    if (!sourceFirmId || !targetFirmId) {
      toast({
        title: 'Error',
        description: 'Please select both source and target firms',
        variant: 'destructive',
      });
      return;
    }

    if (sourceFirmId === targetFirmId) {
      toast({
        title: 'Error',
        description: 'Cannot merge a firm with itself',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get source and target firm details for warning
      const sourceFirm = firms?.find(f => f.id === sourceFirmId);
      const targetFirm = firms?.find(f => f.id === targetFirmId);

      // Move all members from source to target
      const { error: memberError } = await supabase
        .from('firm_members')
        .update({ firm_id: targetFirmId })
        .eq('firm_id', sourceFirmId);

      if (memberError) throw memberError;

      // Update firm_id in logs
      await supabase
        .from('fee_agreement_logs')
        .update({ firm_id: targetFirmId })
        .eq('firm_id', sourceFirmId);

      await supabase
        .from('nda_logs')
        .update({ firm_id: targetFirmId })
        .eq('firm_id', sourceFirmId);

      // Delete source firm (member count will auto-update via trigger)
      const { error: deleteError } = await supabase
        .from('firm_agreements')
        .delete()
        .eq('id', sourceFirmId);

      if (deleteError) throw deleteError;

      // Sync target firm's agreement status to all members (including newly merged)
      // This ensures consistency across all members
      const { error: syncError } = await supabase.rpc('update_fee_agreement_firm_status', {
        p_firm_id: targetFirmId,
        p_is_signed: targetFirm?.fee_agreement_signed || false,
        p_signed_by_user_id: targetFirm?.fee_agreement_signed_by
      });

      if (syncError) console.warn('Warning: Could not sync fee agreements after merge:', syncError);

      const { error: ndaSyncError } = await supabase.rpc('update_nda_firm_status', {
        p_firm_id: targetFirmId,
        p_is_signed: targetFirm?.nda_signed || false,
        p_signed_by_user_id: targetFirm?.nda_signed_by
      });

      if (ndaSyncError) console.warn('Warning: Could not sync NDAs after merge:', ndaSyncError);

      toast({
        title: 'Success',
        description: `Merged ${sourceFirm?.member_count || 0} members from ${sourceFirm?.primary_company_name} into ${targetFirm?.primary_company_name}`,
      });

      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsMergeDialogOpen(false);
      setSourceFirmId('');
      setTargetFirmId('');
    } catch (error: any) {
      console.error('Error merging firms:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to merge firms',
        variant: 'destructive',
      });
    }
  };

  const handleLinkUser = async () => {
    if (!userEmail || !selectedFirmId) {
      toast({
        title: 'Error',
        description: 'Please provide both user email and firm',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Find user by email
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, company_name')
        .eq('email', userEmail)
        .single();

      if (userError) throw new Error('User not found');

      // Check if already linked to a firm
      const { data: existingMember } = await supabase
        .from('firm_members')
        .select('firm_id')
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        toast({
          title: 'Error',
          description: 'User is already linked to a firm',
          variant: 'destructive',
        });
        return;
      }

      // Get firm details to sync agreement status
      const selectedFirm = firms?.find(f => f.id === selectedFirmId);

      // Link user to firm
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      const { error: linkError } = await supabase
        .from('firm_members')
        .insert({
          firm_id: selectedFirmId,
          user_id: user.id,
          is_primary_contact: false,
          added_by: currentUser?.id,
        });

      if (linkError) throw linkError;

      // Sync firm's agreement status to the newly linked user
      if (selectedFirm) {
        const updates: any = {};
        if (selectedFirm.fee_agreement_signed) {
          updates.fee_agreement_signed = true;
          updates.fee_agreement_signed_at = selectedFirm.fee_agreement_signed_at;
          updates.fee_agreement_signed_by = selectedFirm.fee_agreement_signed_by;
        }
        if (selectedFirm.nda_signed) {
          updates.nda_signed = true;
          updates.nda_signed_at = selectedFirm.nda_signed_at;
          updates.nda_signed_by = selectedFirm.nda_signed_by;
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);
        }
      }

      toast({
        title: 'Success',
        description: 'User linked to firm and agreements synced',
      });

      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      setIsLinkDialogOpen(false);
      setUserEmail('');
      setSelectedFirmId('');
    } catch (error: any) {
      console.error('Error linking user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to link user to firm',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <GitMerge className="h-4 w-4 mr-2" />
            Merge Firms
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Duplicate Firms</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Source Firm (will be deleted)</Label>
              <Select value={sourceFirmId} onValueChange={setSourceFirmId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source firm..." />
                </SelectTrigger>
                <SelectContent>
                  {firms?.map((firm) => (
                    <SelectItem key={firm.id} value={firm.id}>
                      {firm.primary_company_name} ({firm.member_count} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Firm (will keep all members)</Label>
              <Select value={targetFirmId} onValueChange={setTargetFirmId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target firm..." />
                </SelectTrigger>
                <SelectContent>
                  {firms?.filter(f => f.id !== sourceFirmId).map((firm) => (
                    <SelectItem key={firm.id} value={firm.id}>
                      {firm.primary_company_name} ({firm.member_count} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleMergeFirms} variant="destructive">
                Merge Firms
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <LinkIcon className="h-4 w-4 mr-2" />
            Link User to Firm
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manually Link User to Firm</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User Email</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Firm</Label>
              <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select firm..." />
                </SelectTrigger>
                <SelectContent>
                  {firms?.map((firm) => (
                    <SelectItem key={firm.id} value={firm.id}>
                      {firm.primary_company_name} ({firm.member_count} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleLinkUser}>
                Link User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
