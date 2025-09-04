import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FileText, Mail, Check, Clock, User } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useUpdateNDA, useLogNDAEmail } from '@/hooks/admin/use-nda';
import { useUpdateFeeAgreement, useLogFeeAgreementEmail } from '@/hooks/admin/use-fee-agreement';

interface PipelineDetailDocumentsProps {
  deal: Deal;
}

export function PipelineDetailDocuments({ deal }: PipelineDetailDocumentsProps) {
  const updateNDA = useUpdateNDA();
  const updateFeeAgreement = useUpdateFeeAgreement();
  const logNDAEmail = useLogNDAEmail();
  const logFeeAgreementEmail = useLogFeeAgreementEmail();

  const getStatusInfo = (status?: string) => {
    switch (status) {
      case 'signed':
        return { 
          icon: Check, 
          label: 'Signed', 
          color: 'text-emerald-600'
        };
      case 'sent':
        return { 
          icon: Clock, 
          label: 'Sent', 
          color: 'text-amber-600'
        };
      default:
        return { 
          icon: FileText, 
          label: 'Not Sent', 
          color: 'text-muted-foreground'
        };
    }
  };

  const handleNDAToggle = (checked: boolean) => {
    if (!deal.buyer_id) return;
    
    updateNDA.mutate({
      userId: deal.buyer_id,
      isSigned: checked
    });
  };

  const handleFeeAgreementToggle = (checked: boolean) => {
    if (!deal.buyer_id) return;
    
    updateFeeAgreement.mutate({
      userId: deal.buyer_id,
      isSigned: checked
    });
  };

  const handleSendNDA = () => {
    if (!deal.buyer_id || !deal.contact_email || !deal.contact_name) return;
    
    logNDAEmail.mutate({
      userId: deal.buyer_id,
      userEmail: deal.contact_email,
      notes: 'Please review and sign the attached NDA.',
      listingTitle: deal.deal_title
    });
  };

  const handleSendFeeAgreement = () => {
    if (!deal.buyer_id || !deal.contact_email || !deal.contact_name) return;
    
    logFeeAgreementEmail.mutate({
      userId: deal.buyer_id,
      userEmail: deal.contact_email,
      content: `Please review and sign the attached Fee Agreement for ${deal.deal_title}.`
    });
  };

  const ndaStatus = getStatusInfo(deal.nda_status);
  const feeStatus = getStatusInfo(deal.fee_agreement_status);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-5 space-y-8">
        {/* NDA Section - Apple Minimal */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Non-Disclosure Agreement</h4>
          
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${deal.nda_status === 'signed' ? 'bg-emerald-500' : deal.nda_status === 'sent' ? 'bg-amber-500' : 'bg-muted-foreground/40'}`} />
              <div>
                <span className="text-sm text-foreground">{ndaStatus.label}</span>
                {deal.nda_status === 'signed' && (
                  <p className="text-xs text-muted-foreground/70">Signed by {deal.contact_name}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSendNDA}
                disabled={logNDAEmail.isPending || !deal.contact_email}
                className="gap-2 h-8 text-xs border-border/60"
              >
                <Mail className="h-3 w-3" />
                Send
              </Button>
              <Switch
                checked={deal.nda_status === 'signed'}
                onCheckedChange={handleNDAToggle}
                disabled={updateNDA.isPending}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Fee Agreement Section - Apple Minimal */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Fee Agreement</h4>
          
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : deal.fee_agreement_status === 'sent' ? 'bg-amber-500' : 'bg-muted-foreground/40'}`} />
              <div>
                <span className="text-sm text-foreground">{feeStatus.label}</span>
                {deal.fee_agreement_status === 'signed' && (
                  <p className="text-xs text-muted-foreground/70">Signed by {deal.contact_name}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSendFeeAgreement}
                disabled={logFeeAgreementEmail.isPending || !deal.contact_email}
                className="gap-2 h-8 text-xs border-border/60"
              >
                <Mail className="h-3 w-3" />
                Send
              </Button>
              <Switch
                checked={deal.fee_agreement_status === 'signed'}
                onCheckedChange={handleFeeAgreementToggle}
                disabled={updateFeeAgreement.isPending}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Document Workflow Progress - Clean */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Workflow Progress</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${deal.nda_status === 'signed' ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                <span className="text-sm text-foreground">NDA Completion</span>
              </div>
              {deal.nda_status === 'signed' && <Check className="h-4 w-4 text-emerald-600" />}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                <span className="text-sm text-foreground">Fee Agreement Completion</span>
              </div>
              {deal.fee_agreement_status === 'signed' && <Check className="h-4 w-4 text-emerald-600" />}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                <span className="text-sm text-foreground">Ready for Detailed Discussions</span>
              </div>
              {deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed' && <Check className="h-4 w-4 text-emerald-600" />}
            </div>
          </div>
        </div>

        {/* Admin Attribution */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Administrative Notes</h4>
          
          <div className="border-l border-border/20 pl-4 space-y-2">
            {deal.nda_status === 'signed' && (
              <div className="text-xs text-muted-foreground/70">
                NDA status last updated by admin
              </div>
            )}
            {deal.fee_agreement_status === 'signed' && (
              <div className="text-xs text-muted-foreground/70">
                Fee Agreement status last updated by admin
              </div>
            )}
            {deal.nda_status === 'not_sent' && deal.fee_agreement_status === 'not_sent' && (
              <div className="text-xs text-muted-foreground/70">
                Documents pending initial contact
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}