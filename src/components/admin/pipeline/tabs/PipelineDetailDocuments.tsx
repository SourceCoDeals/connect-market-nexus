import React from 'react';
import { Switch } from '@/components/ui/switch';
import { User, Mail, FileText, Check, Clock } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useUpdateLeadNDAStatus, useUpdateLeadFeeAgreementStatus, useUpdateLeadNDAEmailStatus, useUpdateLeadFeeAgreementEmailStatus } from '@/hooks/admin/requests/use-lead-status-updates';
import { useConnectionRequestDetails } from '@/hooks/admin/use-connection-request-details';
import { DocumentHistory } from '../DocumentHistory';
import { useQueryClient } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { DealFirmInfo } from '../DealFirmInfo';

interface PipelineDetailDocumentsProps {
  deal: Deal;
}

export function PipelineDetailDocuments({ deal }: PipelineDetailDocumentsProps) {
  const queryClient = useQueryClient();
  const updateNDA = useUpdateLeadNDAStatus();
  const updateFeeAgreement = useUpdateLeadFeeAgreementStatus();
  const logNDAEmail = useUpdateLeadNDAEmailStatus();
  const logFeeAgreementEmail = useUpdateLeadFeeAgreementEmailStatus();
  
  const { data: requestDetails } = useConnectionRequestDetails(deal.connection_request_id);
  
  const getAdminName = (admin?: { first_name: string; last_name: string; email: string }) => {
    if (!admin) return null;
    return `${admin.first_name} ${admin.last_name}`;
  };

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
    }, {
      onSuccess: () => {
        // Force refresh of connection request details to show admin attribution
        queryClient.invalidateQueries({ queryKey: ['connection-request-details', deal.connection_request_id] });
      }
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
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['connection-request-details', deal.connection_request_id] });
      }
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
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['connection-request-details', deal.connection_request_id] });
      }
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
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['connection-request-details', deal.connection_request_id] });
      }
    });
  };

  const ndaStatus = getStatusInfo(deal.nda_status);
  const feeStatus = getStatusInfo(deal.fee_agreement_status);

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex gap-6 px-6 py-6">
        {/* Left Column - Main Content */}
        <div className="flex-1 space-y-6 max-w-3xl">
          {/* Workflow Progress */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Workflow Progress</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Documentation Progress</span>
                  <span className="text-muted-foreground font-mono">
                    {[deal.nda_status, deal.fee_agreement_status].filter(status => status === 'signed').length}/2 Complete
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ 
                      width: `${([deal.nda_status, deal.fee_agreement_status].filter(status => status === 'signed').length / 2) * 100}%` 
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 py-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${deal.nda_status === 'signed' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                  <span className="text-sm text-foreground flex-1">NDA Signed</span>
                  {deal.nda_status === 'signed' && (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-emerald-600 font-mono">Complete</span>
                      {deal.connection_request_id && requestDetails?.user_id && (
                        <DealFirmInfo userId={requestDetails.user_id} compact />
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 py-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                  <span className="text-sm text-foreground flex-1">Fee Agreement Signed</span>
                  {deal.fee_agreement_status === 'signed' && (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-emerald-600 font-mono">Complete</span>
                      {deal.connection_request_id && requestDetails?.user_id && (
                        <DealFirmInfo userId={requestDetails.user_id} compact />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Ready for Deal Discussion */}
              {deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-sm font-medium text-emerald-600">Ready for Deal Discussion</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">All documents signed. You can now proceed with detailed deal negotiations.</p>
                </div>
              )}
            </div>
          </div>

          {/* Next Steps */}
          {(deal.nda_status !== 'signed' || deal.fee_agreement_status !== 'signed') && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Next Steps</h3>
              
              <div className="p-4 bg-muted/10 rounded-lg border border-border/20">
                <div className="space-y-2">
                  {deal.nda_status !== 'signed' && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      • Send and obtain signed NDA before sharing detailed information
                    </p>
                  )}
                  {deal.fee_agreement_status !== 'signed' && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      • Send and obtain signed Fee Agreement to proceed with transaction
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Document History */}
          {requestDetails && (
            <div className="border-t border-border/20 pt-6">
              <DocumentHistory details={requestDetails} />
            </div>
          )}
        </div>

        {/* Right Sidebar - Document Status */}
        <div className="w-80 flex-shrink-0 space-y-6">
          {/* NDA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">NDA</Label>
              <div className={`w-2 h-2 rounded-full ${
                deal.nda_status === 'signed' ? 'bg-emerald-500' : 
                deal.nda_status === 'sent' ? 'bg-amber-500' : 
                'bg-muted-foreground/30'
              }`} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {ndaStatus.label}
              </span>
              <Switch
                checked={deal.nda_status === 'signed'}
                onCheckedChange={handleNDAToggle}
                disabled={updateNDA.isPending}
                className="scale-75"
              />
            </div>
            
            {requestDetails?.lead_nda_signed && requestDetails?.nda_signed_by_admin && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span>Marked by {getAdminName(requestDetails.nda_signed_by_admin)}</span>
              </div>
            )}
            
            {requestDetails?.lead_nda_email_sent && requestDetails?.nda_email_sent_by_admin && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="w-3 h-3" />
                <span>Sent by {getAdminName(requestDetails.nda_email_sent_by_admin)}</span>
              </div>
            )}
            
            <button 
              onClick={handleSendNDA}
              disabled={logNDAEmail.isPending || !deal.contact_email}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 text-center"
            >
              {logNDAEmail.isPending ? 'Logging...' : 'Mark Email as Sent'}
            </button>
          </div>

          <div className="h-px bg-border" />

          {/* Fee Agreement */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Fee Agreement</Label>
              <div className={`w-2 h-2 rounded-full ${
                deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : 
                deal.fee_agreement_status === 'sent' ? 'bg-amber-500' : 
                'bg-muted-foreground/30'
              }`} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {feeStatus.label}
              </span>
              <Switch
                checked={deal.fee_agreement_status === 'signed'}
                onCheckedChange={handleFeeAgreementToggle}
                disabled={updateFeeAgreement.isPending}
                className="scale-75"
              />
            </div>
            
            {requestDetails?.lead_fee_agreement_signed && requestDetails?.fee_signed_by_admin && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span>Marked by {getAdminName(requestDetails.fee_signed_by_admin)}</span>
              </div>
            )}
            
            {requestDetails?.lead_fee_agreement_email_sent && requestDetails?.fee_email_sent_by_admin && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="w-3 h-3" />
                <span>Sent by {getAdminName(requestDetails.fee_email_sent_by_admin)}</span>
              </div>
            )}
            
            <button 
              onClick={handleSendFeeAgreement}
              disabled={logFeeAgreementEmail.isPending || !deal.contact_email}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 text-center"
            >
              {logFeeAgreementEmail.isPending ? 'Logging...' : 'Mark Email as Sent'}
            </button>
          </div>

          <div className="h-px bg-border" />

          {/* Contact Info */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Contact Details</Label>
            
            {deal.contact_name && (
              <div className="space-y-1">
                <p className="text-sm text-foreground">{deal.contact_name}</p>
              </div>
            )}
            {deal.contact_email && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-mono text-xs">{deal.contact_email}</p>
              </div>
            )}
            {deal.contact_company && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{deal.contact_company}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}