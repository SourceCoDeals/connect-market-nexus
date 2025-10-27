import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { NonMarketplaceUser } from "@/types/non-marketplace-user";

interface AgreementToggleProps {
  user: NonMarketplaceUser;
  type: 'nda' | 'fee';
  checked: boolean;
}

export const AgreementToggle = ({ user, type, checked }: AgreementToggleProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedSignerId, setSelectedSignerId] = useState<string>("");
  const [firmMembers, setFirmMembers] = useState<any[]>([]);

  const updateMutation = useMutation({
    mutationFn: async ({ isSigned, signerId }: { isSigned: boolean; signerId?: string }) => {
      if (user.firm_id) {
        // Update at firm level
        const rpcName = type === 'nda' ? 'update_nda_firm_status' : 'update_fee_agreement_firm_status';
        const { error } = await supabase.rpc(rpcName, {
          p_firm_id: user.firm_id,
          p_is_signed: isSigned,
          p_signed_by_user_id: isSigned ? signerId : null,
          p_signed_at: isSigned ? new Date().toISOString() : null,
        });
        if (error) throw error;
      } else {
        // Update individual records
        const updates: any = {};
        
        if (type === 'nda') {
          updates.lead_nda_signed = isSigned;
          updates.lead_nda_signed_at = isSigned ? new Date().toISOString() : null;
          updates.lead_nda_signed_by = isSigned ? signerId : null;
        } else {
          updates.lead_fee_agreement_signed = isSigned;
          updates.lead_fee_agreement_signed_at = isSigned ? new Date().toISOString() : null;
          updates.lead_fee_agreement_signed_by = isSigned ? signerId : null;
        }

        // Update connection requests
        if (user.associated_records.connection_requests.length > 0) {
          const { error } = await supabase
            .from('connection_requests')
            .update(updates)
            .eq('lead_email', user.email);
          if (error) throw error;
        }

        // Update deals
        if (user.associated_records.deals.length > 0) {
          const dealUpdates = type === 'nda' 
            ? { nda_status: isSigned ? 'signed' : 'not_sent' }
            : { fee_agreement_status: isSigned ? 'signed' : 'not_sent' };
          
          const { error } = await supabase
            .from('deals')
            .update(dealUpdates)
            .in('id', user.associated_records.deals.map(d => d.id));
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-marketplace-users'] });
      toast({
        title: `${type.toUpperCase()} ${checked ? 'unsigned' : 'signed'}`,
        description: `Successfully updated ${type.toUpperCase()} status`,
      });
      setShowDialog(false);
      setSelectedSignerId("");
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = async (newChecked: boolean) => {
    if (!newChecked) {
      // Unchecking - no dialog needed
      updateMutation.mutate({ isSigned: false });
      return;
    }

    // Checking - need to select signer if firm exists
    if (user.firm_id) {
      // Fetch firm members
      const { data: members } = await supabase
        .from('firm_members')
        .select('user_id, profiles(id, full_name)')
        .eq('firm_id', user.firm_id)
        .not('user_id', 'is', null);

      if (members && members.length > 0) {
        setFirmMembers(members);
        setShowDialog(true);
        return;
      }
    }

    // No firm or no members - mark as signed without signer
    updateMutation.mutate({ isSigned: true });
  };

  const confirmUpdate = () => {
    updateMutation.mutate({ isSigned: true, signerId: selectedSignerId || undefined });
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Switch
          checked={checked}
          onCheckedChange={handleToggle}
          disabled={updateMutation.isPending}
          className="h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
        />
        <span className="text-xs text-muted-foreground font-normal">
          {type.toUpperCase()}
        </span>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Signer</DialogTitle>
            <DialogDescription>
              Who signed this {type.toUpperCase()} for {user.firm_name || user.company}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Select value={selectedSignerId} onValueChange={setSelectedSignerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a signer..." />
              </SelectTrigger>
              <SelectContent>
                {firmMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profiles?.full_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmUpdate} disabled={!selectedSignerId}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
