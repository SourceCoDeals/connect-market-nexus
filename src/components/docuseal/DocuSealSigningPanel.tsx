import { useState } from 'react';
import { DocusealForm } from '@docuseal/react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface DocuSealSigningPanelProps {
  embedSrc: string;
  onCompleted?: (data: Record<string, unknown>) => void;
  onDeclined?: () => void;
  title?: string;
  description?: string;
}

/**
 * Reusable wrapper around DocuSeal's embedded signing form.
 * Shows loading, success, and error states.
 * Used on Pending Approval page and NDA Gate Modal.
 */
export function DocuSealSigningPanel({
  embedSrc,
  onCompleted,
  onDeclined,
  title = 'Sign Document',
  description = 'Please review and sign the document below.',
}: DocuSealSigningPanelProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'signed' | 'declined' | 'error'>('loading');

  const handleCompleted = (data: Record<string, unknown>) => {
    setStatus('signed');
    onCompleted?.(data);
  };

  const handleDeclined = () => {
    setStatus('declined');
    onDeclined?.();
  };

  if (status === 'signed') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-800">Document Signed</h3>
              <p className="text-sm text-green-600 mt-1">
                Thank you for signing. You can now access the marketplace.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'declined') {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-3 rounded-full bg-amber-100">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-800">Document Declined</h3>
              <p className="text-sm text-amber-600 mt-1">
                You've declined to sign. Contact us if you have questions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {title && (
        <div className="text-center">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      )}

      <div className="relative min-h-[400px]">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading signing form...</p>
            </div>
          </div>
        )}

        <DocusealForm
          src={embedSrc}
          onComplete={handleCompleted}
          onDecline={handleDeclined}
          onLoad={() => setStatus('ready')}
          withTitle={false}
        />
      </div>
    </div>
  );
}
