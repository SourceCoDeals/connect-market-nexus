import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FileText, Mail, Check, Clock, User } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useUpdateLeadNDAStatus, useUpdateLeadFeeAgreementStatus, useUpdateLeadNDAEmailStatus, useUpdateLeadFeeAgreementEmailStatus } from '@/hooks/admin/requests/use-lead-status-updates';

interface PipelineDetailDocumentsProps {
  deal: Deal;
}

export function PipelineDetailDocuments({ deal }: PipelineDetailDocumentsProps) {
  const updateNDA = useUpdateLeadNDAStatus();
  const updateFeeAgreement = useUpdateLeadFeeAgreementStatus();
  const logNDAEmail = useUpdateLeadNDAEmailStatus();
  const logFeeAgreementEmail = useUpdateLeadFeeAgreementEmailStatus();

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

  const handleNDAToggle = async (checked: boolean) => {
    if (!deal.connection_request_id) {
      console.error('No connection request ID available');
      return;
    }
    
    updateNDA.mutate({
      requestId: deal.connection_request_id,
      value: checked
    });
  };

  const handleFeeAgreementToggle = async (checked: boolean) => {
    if (!deal.connection_request_id) {
      console.error('No connection request ID available');
      return;
    }
    
    updateFeeAgreement.mutate({
      requestId: deal.connection_request_id,
      value: checked
    });
  };

  const handleSendNDA = async () => {
    if (!deal.connection_request_id) {
      console.error('No connection request ID available');
      return;
    }
    
    logNDAEmail.mutate({
      requestId: deal.connection_request_id,
      value: true
    });
  };

  const handleSendFeeAgreement = async () => {
    if (!deal.connection_request_id) {
      console.error('No connection request ID available');
      return;
    }
    
    logFeeAgreementEmail.mutate({
      requestId: deal.connection_request_id,
      value: true
    });
  };

  const ndaStatus = getStatusInfo(deal.nda_status);
  const feeStatus = getStatusInfo(deal.fee_agreement_status);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 space-y-8 pb-8">
        {/* Document Status Overview - Apple Clean */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Document Status</h2>
          
          <div className="grid grid-cols-2 gap-6">
            {/* NDA Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">NDA</span>
                <div className={`w-2 h-2 rounded-full ${
                  deal.nda_status === 'signed' ? 'bg-emerald-500' : 
                  deal.nda_status === 'sent' ? 'bg-amber-500' : 
                  'bg-muted-foreground/30'
                }`} />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/70 font-mono">
                  {ndaStatus.label}
                </span>
                <Switch
                  checked={deal.nda_status === 'signed'}
                  onCheckedChange={handleNDAToggle}
                  disabled={updateNDA.isPending}
                  className="scale-75 data-[state=checked]:bg-emerald-500"
                />
              </div>
              
              <button 
                onClick={handleSendNDA}
                disabled={logNDAEmail.isPending || !deal.contact_email}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Send NDA
              </button>
            </div>

            {/* Fee Agreement Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Fee Agreement</span>
                <div className={`w-2 h-2 rounded-full ${
                  deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : 
                  deal.fee_agreement_status === 'sent' ? 'bg-amber-500' : 
                  'bg-muted-foreground/30'
                }`} />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/70 font-mono">
                  {feeStatus.label}
                </span>
                <Switch
                  checked={deal.fee_agreement_status === 'signed'}
                  onCheckedChange={handleFeeAgreementToggle}
                  disabled={updateFeeAgreement.isPending}
                  className="scale-75 data-[state=checked]:bg-emerald-500"
                />
              </div>
              
              <button 
                onClick={handleSendFeeAgreement}
                disabled={logFeeAgreementEmail.isPending || !deal.contact_email}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Send Fee Agreement
              </button>
            </div>
          </div>
        </div>

        {/* Workflow Progress - Minimal */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Workflow Progress</h2>
          
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70">Documentation Progress</span>
                <span className="text-muted-foreground/70 font-mono">
                  {[deal.nda_status, deal.fee_agreement_status].filter(status => status === 'signed').length}/2 Complete
                </span>
              </div>
              <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ 
                    width: `${([deal.nda_status, deal.fee_agreement_status].filter(status => status === 'signed').length / 2) * 100}%` 
                  }}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 py-2">
                <div className={`w-1 h-1 rounded-full ${deal.nda_status === 'signed' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                <span className="text-sm text-foreground">NDA Signed</span>
                {deal.nda_status === 'signed' && (
                  <span className="text-xs text-muted-foreground/70 ml-auto font-mono">Complete</span>
                )}
              </div>
              
              <div className="flex items-center gap-3 py-2">
                <div className={`w-1 h-1 rounded-full ${deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                <span className="text-sm text-foreground">Fee Agreement Signed</span>
                {deal.fee_agreement_status === 'signed' && (
                  <span className="text-xs text-muted-foreground/70 ml-auto font-mono">Complete</span>
                )}
              </div>
              
              <div className="flex items-center gap-3 py-2">
                <div className={`w-1 h-1 rounded-full ${
                  deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed' 
                    ? 'bg-emerald-500' 
                    : 'bg-muted-foreground/30'
                }`} />
                <span className="text-sm text-foreground">Ready for Deal Discussion</span>
                {deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed' && (
                  <span className="text-xs text-muted-foreground/70 ml-auto font-mono">Ready</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Contact Details</h2>
          
          <div className="space-y-3">
            {deal.contact_name && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground">Contact</span>
                <span className="text-sm text-muted-foreground font-mono">{deal.contact_name}</span>
              </div>
            )}
            {deal.contact_email && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground">Email</span>
                <span className="text-sm text-muted-foreground font-mono">{deal.contact_email}</span>
              </div>
            )}
            {deal.contact_company && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground">Company</span>
                <span className="text-sm text-muted-foreground">{deal.contact_company}</span>
              </div>
            )}
          </div>
        </div>

        {/* Next Steps */}
        {(deal.nda_status !== 'signed' || deal.fee_agreement_status !== 'signed') && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foreground">Next Steps</h2>
            
            <div className="p-4 bg-muted/10 rounded-xl border border-border/20">
              <div className="space-y-2">
                {deal.nda_status !== 'signed' && (
                  <p className="text-xs text-muted-foreground/70">
                    • Send and obtain signed NDA before sharing detailed information
                  </p>
                )}
                {deal.fee_agreement_status !== 'signed' && (
                  <p className="text-xs text-muted-foreground/70">
                    • Send and obtain signed Fee Agreement to proceed with transaction
                  </p>
                )}
                {deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed' && (
                  <p className="text-xs text-emerald-700">
                    • All documents complete - ready for detailed deal discussions
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}