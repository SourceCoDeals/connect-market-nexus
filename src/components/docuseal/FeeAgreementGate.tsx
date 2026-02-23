import { useState, useEffect } from 'react';

import { DocuSealSigningPanel } from './DocuSealSigningPanel';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { APP_CONFIG } from '@/config/app';

interface FeeAgreementGateProps {
  userId: string;
  firmId: string;
  listingTitle?: string;
  onSigned: () => void;
  onDismiss: () => void;
}

/**
 * Full-screen modal overlay that intercepts connection request flow
 * when the buyer's firm hasn't signed a fee agreement.
 * Modeled on NdaGateModal but with fee agreement education copy.
 */
export function FeeAgreementGate({ userId, firmId, listingTitle: _listingTitle, onSigned, onDismiss }: FeeAgreementGateProps) {
  void _listingTitle; // reserved for future use
  const queryClient = useQueryClient();
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchEmbedSrc = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-buyer-fee-embed');

        if (cancelled) return;

        if (fnError) {
          setError('Failed to prepare fee agreement signing form');
        } else if (data?.feeSigned) {
          // Already signed, proceed directly
          onSigned();
        } else if (data?.embedSrc) {
          setEmbedSrc(data.embedSrc);
        } else {
          setError('Fee agreement signing form not available. Please contact support.');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchEmbedSrc();
    return () => { cancelled = true; };
  }, [userId, firmId]);

  const handleSigned = () => {
    queryClient.invalidateQueries({ queryKey: ['my-agreement-status'] });
    queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
    setSigned(true);
  };

  if (signed) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true">
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="inline-flex p-3 rounded-full bg-green-100">
              <FileText className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-800">Fee Agreement Signed</h2>
              <p className="text-muted-foreground mt-2">
                You're all set. Continue to submit your connection request.
              </p>
            </div>
            <Button
              onClick={onSigned}
              className="px-8 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium"
            >
              Continue to Request
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="fee-gate-title">
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h2 id="fee-gate-title" className="text-2xl font-bold">One More Step Before Your Request</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              All deals on SourceCo are sourced exclusively by our team. A fee agreement formalizes our working relationship — it takes about 60 seconds.
            </p>
          </div>

          {/* Education Cards */}
          <div className="space-y-3">
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-1">What is a fee agreement?</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A fee agreement is a standard document that confirms our working relationship as your deal source for this and future transactions. It covers the success fee SourceCo earns if and when a deal closes — nothing more.
              </p>
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-1">What you're agreeing to</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our fee is success-only and based on a modified Lehman scale — a percentage of deal value, paid only at close. No retainers, no platform fees, no exclusivity. You're free to pursue deals from other sources at the same time.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                The agreement covers all deals you close through SourceCo.
              </p>
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-1">Why we ask for this before your first request</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We're making a real introduction on your behalf — to a business owner who has trusted us with confidential information. We want that relationship formalized before it begins.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                If you want to discuss the terms before signing, reply to your approval email.
              </p>
            </div>
          </div>

          {/* Signing Form */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Preparing fee agreement signing form...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Please contact <a href={`mailto:${APP_CONFIG.adminEmail}`} className="underline">{APP_CONFIG.adminEmail}</a> for assistance.
              </p>
            </div>
          )}

          {embedSrc && (
            <DocuSealSigningPanel
              embedSrc={embedSrc}
              onCompleted={handleSigned}
              title="Review and sign your fee agreement"
              description="Standard success-fee agreement — review and sign below to continue."
            />
          )}

          {/* Footnote */}
          <p className="text-xs text-muted-foreground text-center">
            Questions about the fee agreement? Email{' '}
            <a href="mailto:adam.haile@sourcecodeals.com" className="text-primary hover:underline">adam.haile@sourcecodeals.com</a>
            {' '}before signing.
          </p>

          {/* Navigation */}
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={onDismiss}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to listings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
