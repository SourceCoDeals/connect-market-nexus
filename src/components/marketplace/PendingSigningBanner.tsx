import { useMyAgreementStatus } from '@/hooks/use-agreement-status';
import { useBuyerNdaStatus } from '@/hooks/admin/use-docuseal';
import { useAuth } from '@/context/AuthContext';
import { Shield, FileSignature, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { AgreementSigningModal } from '@/components/docuseal/AgreementSigningModal';

/**
 * Prominent banner shown on the Marketplace page when a buyer has pending
 * NDA or Fee Agreement signing requests. Opens an inline signing modal.
 */
export function PendingSigningBanner() {
  const { user, isAdmin } = useAuth();
  const { data: ndaStatus, isLoading: ndaLoading } = useBuyerNdaStatus(
    !isAdmin ? user?.id : undefined,
  );
  const { data: coverage, isLoading: coverageLoading } = useMyAgreementStatus(!isAdmin && !!user);
  const [signingOpen, setSigningOpen] = useState(false);
  const [signingType, setSigningType] = useState<'nda' | 'fee_agreement'>('nda');

  if (isAdmin || !user) return null;
  if (ndaLoading || coverageLoading) return null;

  // Determine what needs signing
  const needsNda = ndaStatus?.hasFirm && !ndaStatus.ndaSigned && ndaStatus.hasSubmission;
  const needsFee = coverage && !coverage.fee_covered && coverage.fee_status === 'sent';

  if (!needsNda && !needsFee) return null;

  const openSigning = (type: 'nda' | 'fee_agreement') => {
    setSigningType(type);
    setSigningOpen(true);
  };

  return (
    <>
      <div className="rounded-lg border-2 border-sourceco/40 bg-sourceco-muted p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-sourceco/20 flex-shrink-0">
            <FileSignature className="h-5 w-5 text-sourceco" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">
              Action Required: Agreement Signing
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              {needsNda && needsFee
                ? 'An NDA and Fee Agreement are ready for your signature. Sign them to access full deal details and data rooms.'
                : needsNda
                  ? 'A Non-Disclosure Agreement is ready for your signature. Sign it to access full deal details.'
                  : 'A Fee Agreement is ready for your signature. Sign it to access data room materials.'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              {needsNda && (
                <Button
                  size="sm"
                  className="h-8 text-xs bg-sourceco hover:bg-sourceco/90 text-sourceco-foreground font-medium"
                  onClick={() => openSigning('nda')}
                >
                  <Shield className="h-3.5 w-3.5 mr-1.5" />
                  Sign NDA
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
              {needsFee && (
                <Button
                  size="sm"
                  variant={needsNda ? 'outline' : 'default'}
                  className={
                    needsNda
                      ? 'h-8 text-xs'
                      : 'h-8 text-xs bg-sourceco hover:bg-sourceco/90 text-sourceco-foreground font-medium'
                  }
                  onClick={() => openSigning('fee_agreement')}
                >
                  <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                  Sign Fee Agreement
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AgreementSigningModal
        open={signingOpen}
        onOpenChange={setSigningOpen}
        documentType={signingType}
      />
    </>
  );
}
