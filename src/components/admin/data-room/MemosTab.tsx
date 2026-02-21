/**
 * MemosTab: Two-slot memo interface for the deal page.
 *
 * Each deal has exactly two memo slots:
 *   1. Anonymous Teaser - one-page blind profile, no identifying details
 *   2. Full Lead Memo - comprehensive investment memo sent post-NDA
 *
 * Each slot supports two workflows:
 *   A. Direct Upload: Upload an existing PDF
 *   B. AI-Assisted Generation: Generate .docx draft → edit in Word → save as PDF → upload
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Upload, Sparkles, Download, Trash2, RefreshCw,
  Loader2, FileUp, AlertCircle, CheckCircle2, Calendar,
} from 'lucide-react';
import {
  useDataRoomDocuments,
  useUploadDocument,
  useDeleteDocument,
  useDocumentUrl,
  useGenerateMemo,
  DataRoomDocument,
} from '@/hooks/admin/data-room/use-data-room';
import { generateMemoDocx } from '@/lib/generate-memo-docx';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MemosTabProps {
  dealId: string;
  dealTitle?: string;
}

type MemoSlotType = 'anonymous_teaser' | 'full_memo';

export function MemosTab({ dealId, dealTitle }: MemosTabProps) {
  const { data: documents = [], isLoading } = useDataRoomDocuments(dealId);

  // Find the most recent PDF for each slot
  const teaserDoc = documents.find(d => d.document_category === 'anonymous_teaser');
  const fullMemoDoc = documents.find(d => d.document_category === 'full_memo');

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-pulse"><CardContent className="py-12" /></Card>
        <Card className="animate-pulse"><CardContent className="py-12" /></Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <MemoSlotCard
        dealId={dealId}
        dealTitle={dealTitle}
        slotType="anonymous_teaser"
        title="Anonymous Teaser"
        description="One-page blind profile. No company name, no owner name, no identifying details. Used for initial interest gauging."
        document={teaserDoc}
      />
      <MemoSlotCard
        dealId={dealId}
        dealTitle={dealTitle}
        slotType="full_memo"
        title="Full Lead Memo"
        description="Comprehensive investment memo. Includes company name, financials, operations detail. Sent after NDA execution."
        document={fullMemoDoc}
      />
    </div>
  );
}

// ─── Individual Memo Slot Card ───

interface MemoSlotCardProps {
  dealId: string;
  dealTitle?: string;
  slotType: MemoSlotType;
  title: string;
  description: string;
  document?: DataRoomDocument;
}

function MemoSlotCard({
  dealId,
  dealTitle,
  slotType,
  title,
  description,
  document,
}: MemoSlotCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const documentUrl = useDocumentUrl();
  const generateMemo = useGenerateMemo();

  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const hasDocument = !!document;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      return;
    }

    // If replacing, delete the old document first
    if (document) {
      await deleteDocument.mutateAsync({ documentId: document.id, dealId });
    }

    uploadDocument.mutate({
      file,
      dealId,
      folderName: slotType === 'anonymous_teaser' ? 'Teasers' : 'Memos',
      documentCategory: slotType,
    });

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    if (!document) return;
    documentUrl.mutate(
      { documentId: document.id, action: 'download' },
      {
        onSuccess: (data) => {
          if (data?.url) {
            window.open(data.url, '_blank');
          }
        },
      }
    );
  };

  const handleRemove = () => {
    if (!document) return;
    deleteDocument.mutate({ documentId: document.id, dealId });
    setConfirmRemove(false);
  };

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    try {
      const response = await generateMemo.mutateAsync({
        deal_id: dealId,
        memo_type: slotType,
        branding: 'sourceco',
      });

      // Extract memo content from response
      const memoData = response?.memos?.[slotType];
      if (memoData?.content?.sections) {
        await generateMemoDocx({
          sections: memoData.content.sections,
          memoType: slotType,
          dealTitle: dealTitle || 'Deal',
          branding: 'SourceCo',
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const isUploading = uploadDocument.isPending;
  const isDeleting = deleteDocument.isPending;

  return (
    <>
      <Card className={hasDocument ? 'border-green-200 bg-green-50/30' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {title}
            </CardTitle>
            {hasDocument ? (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Uploaded
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                No memo
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardHeader>
        <CardContent>
          {hasDocument ? (
            // ─── Document Uploaded State ───
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-white">
                <div className="h-10 w-10 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{document.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Calendar className="h-3 w-3" />
                    <span>Uploaded {format(new Date(document.created_at), 'MMM d, yyyy')}</span>
                    {document.file_size_bytes && (
                      <>
                        <span>-</span>
                        <span>{(document.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleDownload}
                  disabled={documentUrl.isPending}
                >
                  {documentUrl.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Replace
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmRemove(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // ─── Empty State ───
            <div className="space-y-3">
              <div className="flex items-center justify-center py-6 border-2 border-dashed rounded-lg bg-muted/30">
                <div className="text-center">
                  <FileUp className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No memo uploaded</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload PDF
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleGenerateDraft}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Draft
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Generate an AI draft (.docx), edit in Word, save as PDF, then upload.
              </p>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the uploaded PDF. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
