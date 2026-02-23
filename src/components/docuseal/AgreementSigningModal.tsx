import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DocuSealSigningPanel } from './DocuSealSigningPanel';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Shield, FileSignature, Download, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { APP_CONFIG } from '@/config/app';

interface AgreementSigningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: 'nda' | 'fee_agreement';
}

/**
 * Modal for buyers to sign NDA or Fee Agreement in-app.
 * Fetches embed_src from the appropriate edge function and renders DocuSealSigningPanel.
 * After signing, calls confirm-agreement-signed to immediately update the DB.
 */
export function AgreementSigningModal({
  open,
  onOpenChange,
  documentType,
}: AgreementSigningModalProps) {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingDraft, setIsDownloadingDraft] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const docLabel = documentType === 'nda' ? 'NDA' : 'Fee Agreement';
  const Icon = documentType === 'nda' ? Shield : FileSignature;

  useEffect(() => {
    if (!open) {
      setEmbedSrc(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchEmbed = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (documentType === 'nda') {
          const { data, error: fnError } = await supabase.functions.invoke('get-buyer-nda-embed');
          if (cancelled) return;

          if (fnError) {
            setError('Failed to load signing form. Please try again.');
          } else if (data?.ndaSigned) {
            toast({ title: 'Already Signed', description: 'Your NDA has already been signed.' });
            onOpenChange(false);
          } else if (data?.embedSrc) {
            setEmbedSrc(data.embedSrc);
          } else {
            setError('Signing form not available. Please contact support.');
          }
        } else {
          const { data, error: fnError } = await supabase.functions.invoke('get-buyer-fee-embed');
          if (cancelled) return;

          if (fnError) {
            setError('Failed to load signing form. Please try again.');
          } else if (data?.feeSigned) {
            toast({ title: 'Already Signed', description: 'Your Fee Agreement has already been signed.' });
            onOpenChange(false);
          } else if (data?.embedSrc) {
            setEmbedSrc(data.embedSrc);
          } else {
            setError('Signing form not available. Please contact support.');
          }
        }
      } catch {
        if (!cancelled) setError('Something went wrong. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchEmbed();
    return () => { cancelled = true; };
  }, [open, documentType]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['buyer-nda-status'] });
    queryClient.invalidateQueries({ queryKey: ['my-agreement-status'] });
    queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
    queryClient.invalidateQueries({ queryKey: ['buyer-firm-agreement-status'] });
    queryClient.invalidateQueries({ queryKey: ['agreement-pending-notifications'] });
    queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
  };

  const handleSigned = () => {
    toast({ title: `${docLabel} Signed!`, description: 'Thank you for signing. Your access has been updated.' });

    // The webhook may take a moment to update the DB.
    // Invalidate immediately, then again after delays to catch the webhook update.
    invalidateAll();
    setTimeout(invalidateAll, 2000);
    setTimeout(invalidateAll, 5000);

    // Auto-close after brief delay so user sees success state
    setTimeout(() => onOpenChange(false), 2500);
  };

  const handleDownloadDraft = async () => {
    setIsDownloadingDraft(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-agreement-document', {
        body: { documentType },
      });
      if (fnError || !data?.documentUrl) {
        toast({ title: 'Download unavailable', description: 'Could not retrieve the document. Please try again.', variant: 'destructive' });
        return;
      }
      window.open(data.documentUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ title: 'Download failed', description: 'Something went wrong.', variant: 'destructive' });
    } finally {
      setIsDownloadingDraft(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Sign {docLabel}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Preparing signing form...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {embedSrc && (
          <>
            <DocuSealSigningPanel
              embedSrc={embedSrc}
              onCompleted={handleSigned}
              successMessage={`${docLabel} signed successfully.`}
              successDescription="Your access has been updated. You can close this dialog."
              title=""
              description=""
            />

            {/* Download draft + contact options */}
            <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={handleDownloadDraft}
                disabled={isDownloadingDraft}
              >
                {isDownloadingDraft ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                Download Draft PDF
              </Button>
              <a
                href={`mailto:${APP_CONFIG.adminEmail}?subject=${encodeURIComponent(`Question about ${docLabel}`)}`}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Questions about terms?
              </a>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
