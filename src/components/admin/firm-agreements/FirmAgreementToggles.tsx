import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateFirmFeeAgreement, useUpdateFirmNDA, type FirmAgreement, type FirmMember } from '@/hooks/admin/use-firm-agreements';
import { FirmSignerSelector } from './FirmSignerSelector';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FirmAgreementTogglesProps {
  firm: FirmAgreement;
  members: FirmMember[];
}

export function FirmAgreementToggles({ firm, members }: FirmAgreementTogglesProps) {
  const updateFeeAgreement = useUpdateFirmFeeAgreement();
  const updateNDA = useUpdateFirmNDA();
  const { toast } = useToast();
  
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [isNDADialogOpen, setIsNDADialogOpen] = useState(false);
  
  const [feeSignedByUserId, setFeeSignedByUserId] = useState<string | null>(null);
  const [feeSignedByName, setFeeSignedByName] = useState<string | null>(null);
  const [ndaSignedByUserId, setNdaSignedByUserId] = useState<string | null>(null);
  const [ndaSignedByName, setNdaSignedByName] = useState<string | null>(null);
  
  const [membersLoading, setMembersLoading] = useState(false);
  const [localMembers, setLocalMembers] = useState<FirmMember[] | null>(null);
  
  const effectiveMembers = localMembers || members;
  
  const ensureMembers = async (): Promise<FirmMember[]> => {
    if ((members?.length ?? 0) > 0) return members;
    if (localMembers && localMembers.length > 0) return localMembers;
    
    setMembersLoading(true);
    try {
      const { data, error } = await supabase
        .from('firm_members')
        .select(`
          *,
          user:profiles(
            id,
            email,
            first_name,
            last_name,
            company,
            buyer_type
          )
        `)
        .eq('firm_id', firm.id)
        .order('is_primary_contact', { ascending: false });
      
      if (error) throw error;
      
      const firmMembers = (data || []) as FirmMember[];
      setLocalMembers(firmMembers);
      return firmMembers;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to load firm members: ${error.message}`,
        variant: 'destructive',
      });
      return [];
    } finally {
      setMembersLoading(false);
    }
  };

  const handleFeeAgreementToggle = async () => {
    const newState = !firm.fee_agreement_signed;
    
    if (newState) {
      // Reset selection when opening dialog
      setFeeSignedByUserId(null);
      setFeeSignedByName(null);
      
      // Ensure we have members loaded before opening dialog
      await ensureMembers();
      setIsFeeDialogOpen(true);
    } else {
      // When toggling OFF, no need for signer selection
      await updateFeeAgreement.mutateAsync({
        firmId: firm.id,
        isSigned: newState,
      });
    }
  };

  const handleNDAToggle = async () => {
    const newState = !firm.nda_signed;
    
    if (newState) {
      // Reset selection when opening dialog
      setNdaSignedByUserId(null);
      setNdaSignedByName(null);
      
      // Ensure we have members loaded before opening dialog
      await ensureMembers();
      setIsNDADialogOpen(true);
    } else {
      // When toggling OFF, no need for signer selection
      await updateNDA.mutateAsync({
        firmId: firm.id,
        isSigned: newState,
      });
    }
  };

  const confirmFeeAgreementUpdate = async () => {
    await updateFeeAgreement.mutateAsync({
      firmId: firm.id,
      isSigned: true,
      signedByUserId: feeSignedByUserId,
      signedByName: feeSignedByName,
    });
    setIsFeeDialogOpen(false);
  };

  const confirmNDAUpdate = async () => {
    await updateNDA.mutateAsync({
      firmId: firm.id,
      isSigned: true,
      signedByUserId: ndaSignedByUserId,
      signedByName: ndaSignedByName,
    });
    setIsNDADialogOpen(false);
  };

  return (
    <>
      {/* Fee Agreement Toggle & Dialog */}
      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            {(updateFeeAgreement.isPending || membersLoading) && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={firm.fee_agreement_signed}
              onCheckedChange={handleFeeAgreementToggle}
              disabled={updateFeeAgreement.isPending || membersLoading}
              className="data-[state=checked]:bg-emerald-600 scale-75"
            />
          </div>
        </div>
        
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Mark Fee Agreement as Signed</DialogTitle>
            <DialogDescription className="text-sm">
              Select who signed the fee agreement for {firm.primary_company_name}
            </DialogDescription>
          </DialogHeader>
          
          <FirmSignerSelector
            members={effectiveMembers}
            onSelect={(userId, name) => {
              setFeeSignedByUserId(userId);
              setFeeSignedByName(name);
            }}
            label="Who signed the fee agreement?"
          />
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setIsFeeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={confirmFeeAgreementUpdate}
              disabled={!feeSignedByUserId && !feeSignedByName}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NDA Toggle & Dialog */}
      <Dialog open={isNDADialogOpen} onOpenChange={setIsNDADialogOpen}>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            {(updateNDA.isPending || membersLoading) && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={firm.nda_signed}
              onCheckedChange={handleNDAToggle}
              disabled={updateNDA.isPending || membersLoading}
              className="data-[state=checked]:bg-emerald-600 scale-75"
            />
          </div>
        </div>
        
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Mark NDA as Signed</DialogTitle>
            <DialogDescription className="text-sm">
              Select who signed the NDA for {firm.primary_company_name}
            </DialogDescription>
          </DialogHeader>
          
          <FirmSignerSelector
            members={effectiveMembers}
            onSelect={(userId, name) => {
              setNdaSignedByUserId(userId);
              setNdaSignedByName(name);
            }}
            label="Who signed the NDA?"
          />
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setIsNDADialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={confirmNDAUpdate}
              disabled={!ndaSignedByUserId && !ndaSignedByName}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
