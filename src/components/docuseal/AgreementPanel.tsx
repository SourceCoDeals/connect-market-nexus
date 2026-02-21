import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DocuSealStatusBadge } from './DocuSealStatusBadge';
import { SendAgreementDialog } from './SendAgreementDialog';
import { Shield, FileCheck, Send, FileDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { FirmAgreement } from '@/hooks/admin/use-firm-agreements';
import type { DocuSealStatus } from '@/hooks/admin/use-docuseal';

interface AgreementPanelProps {
  firm: FirmAgreement;
  buyerEmail?: string;
  buyerName?: string;
}

/**
 * Panel showing NDA + Fee Agreement status with DocuSeal badges,
 * send buttons, and signed document download links.
 * Used on Buyer Detail page.
 */
export function AgreementPanel({ firm, buyerEmail, buyerName }: AgreementPanelProps) {
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDocumentType, setSendDocumentType] = useState<'nda' | 'fee_agreement'>('nda');

  const email = buyerEmail || '';
  const name = buyerName || firm.primary_company_name || '';

  const openSendDialog = (type: 'nda' | 'fee_agreement') => {
    setSendDocumentType(type);
    setSendDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Agreements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* NDA */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">NDA</span>
                <DocuSealStatusBadge
                  status={(firm.nda_docuseal_status || (firm.nda_signed ? 'signed' : 'not_sent')) as DocuSealStatus}
                  signedDocumentUrl={firm.nda_signed_document_url}
                  onSend={!firm.nda_signed ? () => openSendDialog('nda') : undefined}
                  onResend={!firm.nda_signed ? () => openSendDialog('nda') : undefined}
                />
              </div>
              {firm.nda_signed && firm.nda_signed_at && (
                <p className="text-[10px] text-muted-foreground">
                  {firm.nda_signed_by_name && `${firm.nda_signed_by_name} • `}
                  {formatDistanceToNow(new Date(firm.nda_signed_at), { addSuffix: true })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!firm.nda_signed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => openSendDialog('nda')}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Send NDA
                </Button>
              )}
              {firm.nda_signed_document_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => window.open(firm.nda_signed_document_url!, '_blank')}
                >
                  <FileDown className="h-3 w-3 mr-1" />
                  Download
                </Button>
              )}
            </div>
          </div>

          {/* Fee Agreement */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Fee Agreement</span>
                <DocuSealStatusBadge
                  status={(firm.fee_docuseal_status || (firm.fee_agreement_signed ? 'signed' : 'not_sent')) as DocuSealStatus}
                  signedDocumentUrl={firm.fee_signed_document_url}
                  onSend={!firm.fee_agreement_signed ? () => openSendDialog('fee_agreement') : undefined}
                  onResend={!firm.fee_agreement_signed ? () => openSendDialog('fee_agreement') : undefined}
                />
              </div>
              {firm.fee_agreement_signed && firm.fee_agreement_signed_at && (
                <p className="text-[10px] text-muted-foreground">
                  {firm.fee_agreement_signed_by_name && `${firm.fee_agreement_signed_by_name} • `}
                  {formatDistanceToNow(new Date(firm.fee_agreement_signed_at), { addSuffix: true })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!firm.fee_agreement_signed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => openSendDialog('fee_agreement')}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Send Fee Agreement
                </Button>
              )}
              {firm.fee_signed_document_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => window.open(firm.fee_signed_document_url!, '_blank')}
                >
                  <FileDown className="h-3 w-3 mr-1" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SendAgreementDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        firmId={firm.id}
        documentType={sendDocumentType}
        buyerEmail={email}
        buyerName={name}
        firmName={firm.primary_company_name}
      />
    </>
  );
}
