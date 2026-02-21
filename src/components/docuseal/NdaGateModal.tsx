import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocuSealSigningPanel } from './DocuSealSigningPanel';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface NdaGateModalProps {
  userId: string;
  firmId: string;
  onSigned?: () => void;
}

/**
 * Full-screen modal overlay that blocks deal detail access for unsigned buyers.
 * Contains DocuSealSigningPanel inline.
 * Cannot be dismissed without signing or navigating away.
 */
export function NdaGateModal({ userId, firmId, onSigned }: NdaGateModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchEmbedSrc = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', userId)
          .single();

        if (cancelled) return;

        if (!profile) {
          setError('Could not load profile');
          setIsLoading(false);
          return;
        }

        const buyerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

        const { data, error: fnError } = await supabase.functions.invoke('create-docuseal-submission', {
          body: {
            firm_id: firmId,
            document_type: 'nda',
            buyer_email: profile.email,
            buyer_name: buyerName || profile.email,
            send_email: false,
          },
        });

        if (cancelled) return;

        if (fnError) {
          setError('Failed to prepare NDA signing form');
          console.error('DocuSeal submission error:', fnError);
        } else if (data?.embed_src) {
          setEmbedSrc(data.embed_src);
        } else {
          setError('NDA signing form not available. Please contact support.');
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Something went wrong');
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
    queryClient.invalidateQueries({ queryKey: ['buyer-nda-status'] });
    queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
    onSigned?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">NDA Required</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              To view deal details, you need to sign a Non-Disclosure Agreement.
              This protects the confidential information of our deal partners.
            </p>
          </div>

          {/* Signing Form */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Preparing NDA signing form...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Please contact <a href="mailto:adam.haile@sourcecodeals.com" className="underline">adam.haile@sourcecodeals.com</a> for assistance.
              </p>
            </div>
          )}

          {embedSrc && (
            <DocuSealSigningPanel
              embedSrc={embedSrc}
              onCompleted={handleSigned}
              title="Sign NDA"
              description="Review and sign the Non-Disclosure Agreement below to continue."
            />
          )}

          {/* Navigation */}
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => navigate('/marketplace')}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back to Listings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
