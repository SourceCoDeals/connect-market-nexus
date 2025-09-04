import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { FileText, Mail, Check, X, Clock, User } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useUpdateNDA } from '@/hooks/admin/use-nda';
import { useUpdateFeeAgreement } from '@/hooks/admin/use-fee-agreement';
import { useLogNDAEmail } from '@/hooks/admin/use-nda';
import { useLogFeeAgreementEmail } from '@/hooks/admin/use-fee-agreement';
import { formatDistanceToNow } from 'date-fns';

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
          color: 'text-emerald-600', 
          bg: 'bg-emerald-50',
          border: 'border-emerald-200'
        };
      case 'sent':
        return { 
          icon: Clock, 
          label: 'Sent', 
          color: 'text-amber-600', 
          bg: 'bg-amber-50',
          border: 'border-amber-200'
        };
      case 'rejected':
        return { 
          icon: X, 
          label: 'Rejected', 
          color: 'text-red-600', 
          bg: 'bg-red-50',
          border: 'border-red-200'
        };
      default:
        return { 
          icon: FileText, 
          label: 'Not Sent', 
          color: 'text-muted-foreground', 
          bg: 'bg-muted/50',
          border: 'border-border'
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
    
    // Simplified for now - would integrate with existing email system
    console.log('Send NDA email to:', deal.contact_email);
  };

  const handleSendFeeAgreement = () => {
    if (!deal.buyer_id || !deal.contact_email || !deal.contact_name) return;
    
    // Simplified for now - would integrate with existing email system
    console.log('Send Fee Agreement email to:', deal.contact_email);
  };

  const ndaStatus = getStatusInfo(deal.nda_status);
  const feeStatus = getStatusInfo(deal.fee_agreement_status);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        {/* NDA Section */}
        <Card className={`p-5 border-border/40 ${ndaStatus.bg}/30`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${ndaStatus.bg} rounded-lg`}>
                  <ndaStatus.icon className={`h-4 w-4 ${ndaStatus.color}`} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Non-Disclosure Agreement</h4>
                  <Badge variant="outline" className={`text-xs mt-1 ${ndaStatus.bg} ${ndaStatus.color} border-0`}>
                    {ndaStatus.label}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Switch
                  checked={deal.nda_status === 'signed'}
                  onCheckedChange={handleNDAToggle}
                  disabled={updateNDA.isPending}
                />
              </div>
            </div>

            {/* NDA Details */}
            <div className="space-y-3">
              {deal.nda_status === 'signed' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>Signed by {deal.contact_name}</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSendNDA}
                  disabled={logNDAEmail.isPending || !deal.contact_email}
                  className="flex items-center gap-2"
                >
                  <Mail className="h-3 w-3" />
                  Send NDA
                </Button>
                
              </div>
            </div>
          </div>
        </Card>

        {/* Fee Agreement Section */}
        <Card className={`p-5 border-border/40 ${feeStatus.bg}/30`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${feeStatus.bg} rounded-lg`}>
                  <feeStatus.icon className={`h-4 w-4 ${feeStatus.color}`} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Fee Agreement</h4>
                  <Badge variant="outline" className={`text-xs mt-1 ${feeStatus.bg} ${feeStatus.color} border-0`}>
                    {feeStatus.label}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Switch
                  checked={deal.fee_agreement_status === 'signed'}
                  onCheckedChange={handleFeeAgreementToggle}
                  disabled={updateFeeAgreement.isPending}
                />
              </div>
            </div>

            {/* Fee Agreement Details */}
            <div className="space-y-3">
              {deal.fee_agreement_status === 'signed' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>Signed by {deal.contact_name}</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSendFeeAgreement}
                  disabled={logFeeAgreementEmail.isPending || !deal.contact_email}
                  className="flex items-center gap-2"
                >
                  <Mail className="h-3 w-3" />
                  Send Fee Agreement
                </Button>
                
              </div>
            </div>
          </div>
        </Card>

        {/* Document Workflow */}
        <Card className="p-5 border-border/40">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Document Workflow</h4>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${deal.nda_status === 'signed' ? 'bg-emerald-500' : 'bg-muted'}`}></div>
                <span className="text-sm">NDA Completion</span>
                {deal.nda_status === 'signed' && <Check className="h-4 w-4 text-emerald-600" />}
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : 'bg-muted'}`}></div>
                <span className="text-sm">Fee Agreement Completion</span>
                {deal.fee_agreement_status === 'signed' && <Check className="h-4 w-4 text-emerald-600" />}
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : 'bg-muted'}`}></div>
                <span className="text-sm">Ready for Detailed Discussions</span>
                {deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed' && <Check className="h-4 w-4 text-emerald-600" />}
              </div>
            </div>
          </div>
        </Card>

        {/* Email History */}
        <Card className="p-5 border-border/40">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Document Email History</h4>
            
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                No document emails sent yet.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}