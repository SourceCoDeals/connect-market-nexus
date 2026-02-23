import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocuSealSigningPanel } from './DocuSealSigningPanel';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Shield, FileSignature } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AgreementSigningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: 'nda' | 'fee_agreement';
}

/**
 * Modal for buyers to sign NDA or Fee Agreement in-app.
 * Fetches embed_src from the appropriate edge function and renders DocuSealSigningPanel.
 */
export function AgreementSigningModal({
  open,
  onOpenChange,
  documentType,
}: AgreementSigningModalProps) {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          // Use existing buyer-facing NDA endpoint
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
          // Fee agreement — use get-buyer-fee-embed (same pattern)
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

  const handleSigned = () => {
    queryClient.invalidateQueries({ queryKey: ['buyer-nda-status'] });
    queryClient.invalidateQueries({ queryKey: ['my-agreement-status'] });
    queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
    queryClient.invalidateQueries({ queryKey: ['buyer-firm-agreement-status'] });
    queryClient.invalidateQueries({ queryKey: ['agreement-pending-notifications'] });
    toast({ title: `${docLabel} Signed!`, description: 'Thank you for signing. Your access has been updated.' });

    // Auto-close after brief delay so user sees success state
    setTimeout(() => onOpenChange(false), 2000);
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
          <DocuSealSigningPanel
            embedSrc={embedSrc}
            onCompleted={handleSigned}
            title=""
            description=""
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
