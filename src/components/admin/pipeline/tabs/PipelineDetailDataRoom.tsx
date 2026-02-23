import { Switch } from '@/components/ui/switch';
import { User, Mail, FileText, Check, Clock, ShieldCheck, FolderOpen } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useUpdateLeadNDAStatus, useUpdateLeadFeeAgreementStatus, useUpdateLeadNDAEmailStatus, useUpdateLeadFeeAgreementEmailStatus } from '@/hooks/admin/requests/use-lead-status-updates';
import { useConnectionRequestDetails } from '@/hooks/admin/use-connection-request-details';
import { DocumentHistory } from '../DocumentHistory';
import { useQueryClient } from '@tanstack/react-query';

import { DealFirmInfo } from '../DealFirmInfo';
import { DealFirmWarning } from '../DealFirmWarning';
import { useDealEmails } from '@/hooks/admin/use-deal-emails';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PipelineDetailDataRoomProps {
  deal: Deal;
}

export function PipelineDetailDataRoom({ deal }: PipelineDetailDataRoomProps) {
  const queryClient = useQueryClient();
  const updateNDA = useUpdateLeadNDAStatus();
  const updateFeeAgreement = useUpdateLeadFeeAgreementStatus();
  const logNDAEmail = useUpdateLeadNDAEmailStatus();
  const logFeeAgreementEmail = useUpdateLeadFeeAgreementEmailStatus();
  const { data: requestDetails } = useConnectionRequestDetails(deal.connection_request_id);
  const { data: emailHistory = [] } = useDealEmails(deal.deal_id);

  const getAdminName = (admin?: { first_name: string; last_name: string; email: string }) => {
    if (!admin) return null;
    return `${admin.first_name} ${admin.last_name}`.trim();
  };

  const invalidateDetails = () => {
    queryClient.invalidateQueries({ queryKey: ['connection-request-details', deal.connection_request_id] });
  };

  const handleNDAToggle = (checked: boolean) => {
    if (!deal.connection_request_id) return;
    updateNDA.mutate({ requestId: deal.connection_request_id, value: checked }, { onSuccess: invalidateDetails });
  };

  const handleFeeAgreementToggle = (checked: boolean) => {
    if (!deal.connection_request_id) return;
    updateFeeAgreement.mutate({ requestId: deal.connection_request_id, value: checked }, { onSuccess: invalidateDetails });
  };

  const handleSendNDA = () => {
    if (!deal.connection_request_id) return;
    logNDAEmail.mutate({ requestId: deal.connection_request_id, value: true }, { onSuccess: invalidateDetails });
  };

  const handleSendFeeAgreement = () => {
    if (!deal.connection_request_id) return;
    logFeeAgreementEmail.mutate({ requestId: deal.connection_request_id, value: true }, { onSuccess: invalidateDetails });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'bg-emerald-500';
      case 'sent': return 'bg-amber-500';
      default: return 'bg-muted-foreground/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'signed': return 'Signed';
      case 'sent': return 'Sent';
      default: return 'Not Sent';
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <ScrollArea className="h-full">
        <div className="px-6 py-6 space-y-8">
          {/* Firm Warning */}
          <DealFirmWarning
            connectionRequestId={deal.connection_request_id ?? null}
            actionType="fee_agreement"
          />

          {/* Section A: Access Control */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Access Control</h3>
            </div>

            <div className="space-y-3">
              {/* NDA */}
              <div className="p-4 border border-border/40 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(deal.nda_status)}`} />
                    <span className="text-sm font-medium text-foreground">NDA</span>
                    <span className="text-xs text-muted-foreground">{getStatusLabel(deal.nda_status)}</span>
                  </div>
                  <Switch
                    checked={deal.nda_status === 'signed'}
                    onCheckedChange={handleNDAToggle}
                    disabled={updateNDA.isPending || !deal.connection_request_id}
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
                  disabled={logNDAEmail.isPending || !deal.connection_request_id}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {logNDAEmail.isPending ? 'Logging...' : 'Mark Email as Sent'}
                </button>
              </div>

              {/* Fee Agreement */}
              <div className="p-4 border border-border/40 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(deal.fee_agreement_status)}`} />
                    <span className="text-sm font-medium text-foreground">Fee Agreement</span>
                    <span className="text-xs text-muted-foreground">{getStatusLabel(deal.fee_agreement_status)}</span>
                  </div>
                  <Switch
                    checked={deal.fee_agreement_status === 'signed'}
                    onCheckedChange={handleFeeAgreementToggle}
                    disabled={updateFeeAgreement.isPending || !deal.connection_request_id}
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
                  disabled={logFeeAgreementEmail.isPending || !deal.connection_request_id}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {logFeeAgreementEmail.isPending ? 'Logging...' : 'Mark Email as Sent'}
                </button>
              </div>

              {/* Workflow Progress */}
              <div className="p-4 border border-border/40 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Documentation Progress</span>
                  <span className="text-muted-foreground font-mono">
                    {[deal.nda_status, deal.fee_agreement_status].filter(s => s === 'signed').length}/2 Complete
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${([deal.nda_status, deal.fee_agreement_status].filter(s => s === 'signed').length / 2) * 100}%`
                    }}
                  />
                </div>
                {deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed' && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <Check className="w-3.5 h-3.5" />
                    <span className="font-medium">Ready for Deal Discussion</span>
                  </div>
                )}
                {deal.connection_request_id && requestDetails?.user_id && (
                  <DealFirmInfo userId={requestDetails.user_id} compact />
                )}
              </div>
            </div>
          </div>

          {/* Section B: Sent/Unsent Tracker */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Distribution Tracker</h3>
            </div>

            {emailHistory.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-border/40 rounded-lg">
                <Mail className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No documents sent yet</p>
              </div>
            ) : (
              <div className="border border-border/40 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border/30">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Type</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Sent</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailHistory.map((email) => (
                      <tr key={email.id} className="border-b border-border/20 last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{email.email_type}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 ${
                            email.status === 'delivered' ? 'text-emerald-600' : 'text-muted-foreground'
                          }`}>
                            {email.status === 'delivered' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {email.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDistanceToNow(new Date(email.sent_at), { addSuffix: true })}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground font-mono truncate max-w-[120px]">
                          {email.email}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section C: Document History / Activity */}
          {requestDetails && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">Document Activity</h3>
              </div>
              <DocumentHistory details={requestDetails} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
