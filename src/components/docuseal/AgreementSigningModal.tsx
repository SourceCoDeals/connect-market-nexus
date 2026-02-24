import { useState, useEffect } from 'react';
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
import { Loader2, Shield, FileSignature, Download, MessageSquare, ZoomIn, ZoomOut } from 'lucide-react';
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const ZOOM_STEP = 0.15;
  const MIN_ZOOM = 0.75;
  const MAX_ZOOM = 2;

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  const handleZoomReset = () => setZoomLevel(1);

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

  const handleSigned = async () => {
    toast({ title: `${docLabel} Signed!`, description: 'Thank you for signing. Your access has been updated.' });

    // Immediately confirm with backend — updates DB, creates notifications & messages
    // This ensures the DB is updated before the webhook arrives
    try {
      await supabase.functions.invoke('confirm-agreement-signed', {
        body: { documentType },
      });
    } catch (err) {
      console.warn('confirm-agreement-signed call failed (webhook will handle):', err);
    }

    // Invalidate immediately, then again after delays to catch any remaining updates
    invalidateAll();

    // Auto-close after brief delay so user sees success state
    const timer = setTimeout(() => onOpenChange(false), 2000);
    return () => clearTimeout(timer);
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
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col overflow-hidden">
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
            <div className="flex-1 overflow-auto min-h-0">
              <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', width: `${100 / zoomLevel}%` }}>
                <DocuSealSigningPanel
                  embedSrc={embedSrc}
                  onCompleted={handleSigned}
                  successMessage={`${docLabel} signed successfully.`}
                  successDescription="Your access has been updated. You can close this dialog."
                  title=""
                  description=""
                />
              </div>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center justify-center gap-1 border-t border-border pt-2 mt-2">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={zoomLevel <= MIN_ZOOM}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs min-w-[3.5rem] font-mono" onClick={handleZoomReset}>
                {Math.round(zoomLevel * 100)}%
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={zoomLevel >= MAX_ZOOM}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Download draft + contact options */}
            <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
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
