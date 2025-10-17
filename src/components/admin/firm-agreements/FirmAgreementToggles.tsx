import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useUpdateFirmFeeAgreement, useUpdateFirmNDA, type FirmAgreement, type FirmMember } from '@/hooks/admin/use-firm-agreements';
import { FirmSignerSelector } from './FirmSignerSelector';
import { Loader2 } from 'lucide-react';

interface FirmAgreementTogglesProps {
  firm: FirmAgreement;
  members: FirmMember[];
}

export function FirmAgreementToggles({ firm, members }: FirmAgreementTogglesProps) {
  const updateFeeAgreement = useUpdateFirmFeeAgreement();
  const updateNDA = useUpdateFirmNDA();
  
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [isNDADialogOpen, setIsNDADialogOpen] = useState(false);
  
  const [feeSignedByUserId, setFeeSignedByUserId] = useState<string | null>(null);
  const [feeSignedByName, setFeeSignedByName] = useState<string | null>(null);
  const [ndaSignedByUserId, setNdaSignedByUserId] = useState<string | null>(null);
  const [ndaSignedByName, setNdaSignedByName] = useState<string | null>(null);

  const handleFeeAgreementToggle = async () => {
    const newState = !firm.fee_agreement_signed;
    
    if (newState && members.length > 0) {
      // Show dialog to select signer
      setIsFeeDialogOpen(true);
    } else {
      // Direct toggle off
      await updateFeeAgreement.mutateAsync({
        firmId: firm.id,
        isSigned: newState,
      });
    }
  };

  const handleNDAToggle = async () => {
    const newState = !firm.nda_signed;
    
    if (newState && members.length > 0) {
      // Show dialog to select signer
      setIsNDADialogOpen(true);
    } else {
      // Direct toggle off
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
    <div className="flex gap-4">
      {/* Fee Agreement Toggle */}
      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <div className="flex items-center gap-2">
          <Switch
            checked={firm.fee_agreement_signed}
            onCheckedChange={handleFeeAgreementToggle}
            disabled={updateFeeAgreement.isPending}
          />
          <Label className="text-sm cursor-pointer" onClick={handleFeeAgreementToggle}>
            Fee Agreement
          </Label>
          {updateFeeAgreement.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Fee Agreement as Signed</DialogTitle>
            <DialogDescription>
              Select who signed the fee agreement for {firm.primary_company_name}
            </DialogDescription>
          </DialogHeader>
          
          <FirmSignerSelector
            members={members}
            onSelect={(userId, name) => {
              setFeeSignedByUserId(userId);
              setFeeSignedByName(name);
            }}
            label="Who signed the fee agreement?"
          />
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsFeeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmFeeAgreementUpdate}
              disabled={!feeSignedByUserId && !feeSignedByName}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NDA Toggle */}
      <Dialog open={isNDADialogOpen} onOpenChange={setIsNDADialogOpen}>
        <div className="flex items-center gap-2">
          <Switch
            checked={firm.nda_signed}
            onCheckedChange={handleNDAToggle}
            disabled={updateNDA.isPending}
          />
          <Label className="text-sm cursor-pointer" onClick={handleNDAToggle}>
            NDA
          </Label>
          {updateNDA.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark NDA as Signed</DialogTitle>
            <DialogDescription>
              Select who signed the NDA for {firm.primary_company_name}
            </DialogDescription>
          </DialogHeader>
          
          <FirmSignerSelector
            members={members}
            onSelect={(userId, name) => {
              setNdaSignedByUserId(userId);
              setNdaSignedByName(name);
            }}
            label="Who signed the NDA?"
          />
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsNDADialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmNDAUpdate}
              disabled={!ndaSignedByUserId && !ndaSignedByName}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
