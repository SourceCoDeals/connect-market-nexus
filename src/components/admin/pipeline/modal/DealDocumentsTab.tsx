import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Deal } from '@/hooks/admin/use-deals';
import { useUpdateNDA, useUpdateNDAEmailSent } from '@/hooks/admin/use-nda';
import { useUpdateFeeAgreement, useUpdateFeeAgreementEmailSent } from '@/hooks/admin/use-fee-agreement';
import { formatDate } from '@/lib/utils';
import { FileText, Send, CheckCircle, Clock, AlertCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DealDocumentsTabProps {
  deal: Deal;
}

export function DealDocumentsTab({ deal }: DealDocumentsTabProps) {
  const { toast } = useToast();
  
  // NDA hooks
  const updateNDA = useUpdateNDA();
  const updateNDAEmail = useUpdateNDAEmailSent();
  
  // Fee Agreement hooks
  const updateFeeAgreement = useUpdateFeeAgreement();
  const updateFeeAgreementEmail = useUpdateFeeAgreementEmailSent();

  const handleNDAToggle = (signed: boolean) => {
    if (!deal.buyer_id) return;
    updateNDA.mutate({
      userId: deal.buyer_id,
      isSigned: signed
    });
  };

  const handleNDAEmailToggle = (sent: boolean) => {
    if (!deal.buyer_id) return;
    updateNDAEmail.mutate({
      userId: deal.buyer_id,
      isSent: sent
    });
  };

  const handleFeeAgreementToggle = (signed: boolean) => {
    if (!deal.buyer_id) return;
    updateFeeAgreement.mutate({
      userId: deal.buyer_id,
      isSigned: signed
    });
  };

  const handleFeeAgreementEmailToggle = (sent: boolean) => {
    if (!deal.buyer_id) return;
    updateFeeAgreementEmail.mutate({
      userId: deal.buyer_id,
      isSent: sent
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'signed':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'sent':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'signed':
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'sent':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Determine status based on existing Deal fields  
  const ndaStatus = deal.nda_status === 'signed' ? 'signed' : (deal.nda_status === 'sent' ? 'sent' : 'pending');
  const feeAgreementStatus = deal.fee_agreement_status === 'signed' ? 'signed' : (deal.fee_agreement_status === 'sent' ? 'sent' : 'pending');

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage NDA and fee agreement status for this deal
        </p>
      </div>

      {/* NDA Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            Non-Disclosure Agreement (NDA)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Status Overview */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(ndaStatus)}
                <div>
                  <p className="font-semibold text-gray-900">NDA Status</p>
                  <Badge className={`${getStatusColor(ndaStatus)} text-xs mt-1`}>
                    {ndaStatus.charAt(0).toUpperCase() + ndaStatus.slice(1)}
                  </Badge>
                </div>
              </div>
              <div className="text-right text-sm text-gray-600">
                <p>Status: {ndaStatus}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Email Sent</p>
                  <p className="text-sm text-gray-600">Mark NDA email as sent to buyer</p>
                </div>
                <Switch
                  checked={deal.nda_status === 'sent' || deal.nda_status === 'signed'}
                  onCheckedChange={handleNDAEmailToggle}
                  disabled={updateNDAEmail.isPending}
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Document Signed</p>
                  <p className="text-sm text-gray-600">Mark NDA as signed by buyer</p>
                </div>
                <Switch
                  checked={deal.nda_status === 'signed'}
                  onCheckedChange={handleNDAToggle}
                  disabled={updateNDA.isPending}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-200"
                onClick={() => {
                  // In a real app, this would trigger the NDA email flow
                  toast({
                    title: "NDA Email",
                    description: "NDA email functionality would be triggered here"
                  });
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Send NDA Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-200"
                onClick={() => {
                  // In a real app, this would open the NDA document
                  toast({
                    title: "NDA Document",
                    description: "NDA document would open here"
                  });
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                View Document
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee Agreement Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            Fee Agreement
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Status Overview */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(feeAgreementStatus)}
                <div>
                  <p className="font-semibold text-gray-900">Fee Agreement Status</p>
                  <Badge className={`${getStatusColor(feeAgreementStatus)} text-xs mt-1`}>
                    {feeAgreementStatus.charAt(0).toUpperCase() + feeAgreementStatus.slice(1)}
                  </Badge>
                </div>
              </div>
              <div className="text-right text-sm text-gray-600">
                <p>Status: {feeAgreementStatus}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Email Sent</p>
                  <p className="text-sm text-gray-600">Mark fee agreement email as sent to buyer</p>
                </div>
                <Switch
                  checked={deal.fee_agreement_status === 'sent' || deal.fee_agreement_status === 'signed'}
                  onCheckedChange={handleFeeAgreementEmailToggle}
                  disabled={updateFeeAgreementEmail.isPending}
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Document Signed</p>
                  <p className="text-sm text-gray-600">Mark fee agreement as signed by buyer</p>
                </div>
                <Switch
                  checked={deal.fee_agreement_status === 'signed'}
                  onCheckedChange={handleFeeAgreementToggle}
                  disabled={updateFeeAgreement.isPending}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-200"
                onClick={() => {
                  // In a real app, this would trigger the fee agreement email flow
                  toast({
                    title: "Fee Agreement Email",
                    description: "Fee agreement email functionality would be triggered here"
                  });
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Fee Agreement
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-200"
                onClick={() => {
                  // In a real app, this would open the fee agreement document
                  toast({
                    title: "Fee Agreement Document",
                    description: "Fee agreement document would open here"
                  });
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                View Document
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Follow-up Status */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-600" />
            Follow-up Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <p className="font-semibold text-gray-900">Positive Follow-up</p>
              </div>
              <p className="text-sm text-gray-600">
                {deal.followed_up ? 'Completed' : 'Pending'}
              </p>
              {deal.followed_up_at && (
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(deal.followed_up_at)}
                </p>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <p className="font-semibold text-gray-900">Negative Follow-up</p>
              </div>
              <p className="text-sm text-gray-600">
                {deal.followed_up ? 'Completed' : 'Pending'}
              </p>
              {deal.followed_up_at && (
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(deal.followed_up_at)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}