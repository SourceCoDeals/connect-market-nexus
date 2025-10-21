import { useState } from 'react';
import { Settings, GitMerge, Link as LinkIcon, AlertTriangle, Check, X, FileCheck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFirmAgreements } from '@/hooks/admin/use-firm-agreements';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export function FirmManagementTools() {
  const { data: firms } = useFirmAgreements();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [showMergeConfirmation, setShowMergeConfirmation] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [sourceFirmId, setSourceFirmId] = useState('');
  const [targetFirmId, setTargetFirmId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [selectedFirmId, setSelectedFirmId] = useState('');

  const sourceFirm = firms?.find(f => f.id === sourceFirmId);
  const targetFirm = firms?.find(f => f.id === targetFirmId);
  
  const agreementsDiffer = sourceFirm && targetFirm && (
    sourceFirm.fee_agreement_signed !== targetFirm.fee_agreement_signed ||
    sourceFirm.nda_signed !== targetFirm.nda_signed
  );

  const handleProceedToMerge = () => {
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

    setShowMergeConfirmation(true);
  };

  const handleMergeFirms = async () => {
    try {

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
      setShowMergeConfirmation(false);
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Merge Duplicate Firms</DialogTitle>
            <DialogDescription>
              Select the source and target firms. All members will be moved to the target firm.
            </DialogDescription>
          </DialogHeader>
          
          {!showMergeConfirmation ? (
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
                <Button onClick={handleProceedToMerge} variant="default">
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Agreement Status Comparison */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <h4 className="font-medium text-sm">Agreement Status Comparison</h4>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-xs font-medium text-muted-foreground">Agreement</div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Source Firm
                    <div className="text-foreground mt-1 font-normal truncate">{sourceFirm?.primary_company_name}</div>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Target Firm
                    <div className="text-foreground mt-1 font-normal truncate">{targetFirm?.primary_company_name}</div>
                  </div>

                  {/* Fee Agreement Row */}
                  <div className="flex items-center gap-2 text-sm">
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    Fee Agreement
                  </div>
                  <div>
                    <AgreementStatusBadge signed={sourceFirm?.fee_agreement_signed} />
                  </div>
                  <div>
                    <AgreementStatusBadge signed={targetFirm?.fee_agreement_signed} />
                  </div>

                  {/* NDA Row */}
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    NDA
                  </div>
                  <div>
                    <AgreementStatusBadge signed={sourceFirm?.nda_signed} />
                  </div>
                  <div>
                    <AgreementStatusBadge signed={targetFirm?.nda_signed} />
                  </div>
                </div>
              </div>

              {/* Warning Alert if agreements differ */}
              {agreementsDiffer && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Agreement Status Will Change</AlertTitle>
                  <AlertDescription>
                    The source and target firms have different agreement statuses. After merge:
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>All {sourceFirm?.member_count} members from <strong>{sourceFirm?.primary_company_name}</strong> will be moved to <strong>{targetFirm?.primary_company_name}</strong></li>
                      <li>They will inherit the <strong>target firm's</strong> agreement status</li>
                      <li>Their connection requests and deals will be updated accordingly</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Summary */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium text-sm">Merge Summary</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {sourceFirm?.member_count} members will be moved to target firm</li>
                  <li>• Source firm "{sourceFirm?.primary_company_name}" will be deleted</li>
                  <li>• All logs will be transferred to target firm</li>
                  <li>• Agreement statuses will sync to match target firm</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowMergeConfirmation(false)}>
                  Back
                </Button>
                <Button onClick={handleMergeFirms} variant="destructive">
                  Confirm Merge
                </Button>
              </div>
            </div>
          )}
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

function AgreementStatusBadge({ signed }: { signed?: boolean }) {
  return (
    <Badge 
      variant={signed ? "default" : "outline"}
      className={cn(
        "text-xs font-medium",
        signed 
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" 
          : "bg-muted text-muted-foreground"
      )}
    >
      {signed ? (
        <>
          <Check className="h-3 w-3 mr-1" />
          Signed
        </>
      ) : (
        <>
          <X className="h-3 w-3 mr-1" />
          Not Signed
        </>
      )}
    </Badge>
  );
}
