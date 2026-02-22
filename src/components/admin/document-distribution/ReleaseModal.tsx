/**
 * ReleaseModal: Reusable modal for releasing documents to buyers.
 *
 * Triggered by any "Release to Buyer" button on the deal page.
 * Shows: document info, buyer selector, release method, legal status, actions.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Link2, Download, Copy, Check, Loader2 } from 'lucide-react';
import { useGenerateTrackedLink, useLogPdfDownload, type DealDocument } from '@/hooks/admin/use-document-distribution';

interface BuyerOption {
  id?: string;
  name: string;
  email: string;
  firm?: string;
  nda_status?: string;
  fee_agreement_status?: string;
}

interface ReleaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DealDocument | null;
  dealId: string;
  projectName?: string | null;
  buyers?: BuyerOption[];
  defaultMethod?: 'tracked_link' | 'pdf_download';
}

export function ReleaseModal({
  open,
  onOpenChange,
  document,
  dealId,
  projectName,
  buyers = [],
  defaultMethod = 'tracked_link',
}: ReleaseModalProps) {
  const [selectedBuyer, setSelectedBuyer] = useState<string | undefined>(undefined);
  const [customBuyer, setCustomBuyer] = useState({ name: '', email: '', firm: '' });
  const [showCustomBuyer, setShowCustomBuyer] = useState(false);
  const [method, setMethod] = useState<'tracked_link' | 'pdf_download'>(defaultMethod);
  const [notes, setNotes] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLink = useGenerateTrackedLink();
  const logDownload = useLogPdfDownload();

  const isLoading = generateLink.isPending || logDownload.isPending;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedBuyer(undefined);
      setCustomBuyer({ name: '', email: '', firm: '' });
      setShowCustomBuyer(false);
      setMethod(defaultMethod);
      setNotes('');
      setGeneratedLink(null);
      setCopied(false);
    }
  }, [open, defaultMethod]);

  const currentBuyer = showCustomBuyer
    ? customBuyer
    : buyers.find(b => b.id === selectedBuyer || b.email === selectedBuyer);

  const isAnonymousTeaser = document?.document_type === 'anonymous_teaser';
  const buyerNdaStatus = currentBuyer && 'nda_status' in currentBuyer ? (currentBuyer as BuyerOption).nda_status : undefined;
  const buyerFeeStatus = currentBuyer && 'fee_agreement_status' in currentBuyer ? (currentBuyer as BuyerOption).fee_agreement_status : undefined;
  const needsLegalWarning =
    !isAnonymousTeaser &&
    currentBuyer &&
    (buyerNdaStatus !== 'signed' || buyerFeeStatus !== 'signed');

  const canSubmit =
    document &&
    (showCustomBuyer
      ? customBuyer.name && customBuyer.email
      : selectedBuyer) &&
    !generatedLink;

  const handleSubmit = async () => {
    if (!document || !currentBuyer) return;

    const buyerParams = {
      deal_id: dealId,
      document_id: document.id,
      buyer_name: showCustomBuyer ? customBuyer.name : currentBuyer.name,
      buyer_email: showCustomBuyer ? customBuyer.email : currentBuyer.email,
      buyer_firm: showCustomBuyer ? customBuyer.firm : currentBuyer.firm,
      buyer_id: showCustomBuyer ? undefined : (currentBuyer as BuyerOption).id,
      release_notes: notes || undefined,
    };

    if (method === 'tracked_link') {
      const result = await generateLink.mutateAsync(buyerParams);
      setGeneratedLink(result.link_url);
    } else {
      const result = await logDownload.mutateAsync(buyerParams);
      // Trigger download
      if (result.download_url) {
        window.open(result.download_url, '_blank');
      }
      onOpenChange(false);
    }
  };

  const handleCopy = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Release Document</DialogTitle>
          <DialogDescription>
            Release this document to a buyer via tracked link or PDF download.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Section 1: Document being released */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Document</Label>
            <div className="flex items-center gap-2">
              <span className="font-medium">{document.title}</span>
              <Badge variant="outline" className="text-xs">
                {document.document_type === 'anonymous_teaser' ? 'Teaser' :
                 document.document_type === 'data_room_file' ? 'Data Room' : 'Internal'}
              </Badge>
            </div>
            {document.document_type === 'anonymous_teaser' && !projectName && (
              <div className="flex items-center gap-1.5 text-amber-600 text-sm mt-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Set a Project Name before distributing this document
              </div>
            )}
          </div>

          {/* Section 2: Buyer selection */}
          {!generatedLink && (
            <div className="space-y-2">
              <Label>Who are you sending this to?</Label>
              {!showCustomBuyer ? (
                <>
                  <Select value={selectedBuyer} onValueChange={setSelectedBuyer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a buyer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {buyers.map(buyer => (
                        <SelectItem key={buyer.id || buyer.email} value={buyer.id || buyer.email}>
                          {buyer.name} {buyer.firm ? `(${buyer.firm})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowCustomBuyer(true)}
                  >
                    + Add buyer not in pipeline
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Buyer name"
                    value={customBuyer.name}
                    onChange={e => setCustomBuyer(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Email address"
                    type="email"
                    value={customBuyer.email}
                    onChange={e => setCustomBuyer(prev => ({ ...prev, email: e.target.value }))}
                  />
                  <Input
                    placeholder="Firm (optional)"
                    value={customBuyer.firm}
                    onChange={e => setCustomBuyer(prev => ({ ...prev, firm: e.target.value }))}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setShowCustomBuyer(false);
                      setCustomBuyer({ name: '', email: '', firm: '' });
                    }}
                  >
                    Back to pipeline buyers
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Release method */}
          {!generatedLink && (
            <div className="space-y-2">
              <Label>Release method</Label>
              <RadioGroup
                value={method}
                onValueChange={v => setMethod(v as 'tracked_link' | 'pdf_download')}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tracked_link" id="tracked_link" />
                  <label htmlFor="tracked_link" className="text-sm cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5" />
                      Send as tracked link
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Opens will be recorded. Link can be revoked.
                    </p>
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pdf_download" id="pdf_download" />
                  <label htmlFor="pdf_download" className="text-sm cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      Download as PDF
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send recorded, opens are not tracked.
                    </p>
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Section 4: Legal status */}
          {currentBuyer && !generatedLink && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Legal status</Label>
              <div className="flex gap-2">
                <Badge
                  variant={buyerNdaStatus === 'signed' ? 'default' : 'secondary'}
                  className={buyerNdaStatus === 'signed' ? 'bg-green-100 text-green-800' : ''}
                >
                  NDA: {buyerNdaStatus || 'Unknown'}
                </Badge>
                <Badge
                  variant={buyerFeeStatus === 'signed' ? 'default' : 'secondary'}
                  className={buyerFeeStatus === 'signed' ? 'bg-green-100 text-green-800' : ''}
                >
                  Fee Agreement: {buyerFeeStatus || 'Unknown'}
                </Badge>
              </div>
              {needsLegalWarning && (
                <div className="flex items-center gap-1.5 text-amber-600 text-sm bg-amber-50 rounded p-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  This buyer has not completed required agreements. Proceed with caution.
                </div>
              )}
            </div>
          )}

          {/* Section 5: Notes */}
          {!generatedLink && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
              <Textarea
                placeholder="Add notes about this release..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Success: Generated link */}
          {generatedLink && (
            <div className="space-y-2 bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800">Release logged. Share this link:</p>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="text-sm bg-white" />
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {generatedLink ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading || (isAnonymousTeaser && !projectName)}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Release & Log
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
