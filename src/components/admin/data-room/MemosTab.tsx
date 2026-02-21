/**
 * MemosTab: Two-slot memo interface for the deal page.
 *
 * Each deal has two memo slots: Anonymous Teaser & Full Lead Memo
 * 
 * Workflow per slot:
 *   1. Generate Draft → AI creates content saved to lead_memos table (viewable in-app)
 *   2. Download Draft → Export saved draft as .docx for editing in Word
 *   3. Upload Final PDF → Upload the polished PDF to data_room_documents
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Upload, Sparkles, Download, Trash2, RefreshCw,
  Loader2, FileUp, CheckCircle2, Calendar, Eye, BookOpen,
} from 'lucide-react';
import {
  useDataRoomDocuments,
  useUploadDocument,
  useDeleteDocument,
  useDocumentUrl,
  useGenerateMemo,
  useLeadMemos,
  DataRoomDocument,
  LeadMemo,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface MemosTabProps {
  dealId: string;
  dealTitle?: string;
}

type MemoSlotType = 'anonymous_teaser' | 'full_memo';

export function MemosTab({ dealId, dealTitle }: MemosTabProps) {
  const { data: documents = [], isLoading: docsLoading } = useDataRoomDocuments(dealId);
  const { data: memos = [], isLoading: memosLoading } = useLeadMemos(dealId);

  // Find the most recent PDF for each slot
  const teaserDoc = documents.find(d => d.document_category === 'anonymous_teaser');
  const fullMemoDoc = documents.find(d => d.document_category === 'full_memo');

  // Find the most recent AI draft for each slot
  const teaserDraft = memos.find(m => m.memo_type === 'anonymous_teaser');
  const fullMemoDraft = memos.find(m => m.memo_type === 'full_memo');

  const isLoading = docsLoading || memosLoading;

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
        draft={teaserDraft}
      />
      <MemoSlotCard
        dealId={dealId}
        dealTitle={dealTitle}
        slotType="full_memo"
        title="Full Lead Memo"
        description="Comprehensive investment memo. Includes company name, financials, operations detail. Sent after NDA execution."
        document={fullMemoDoc}
        draft={fullMemoDraft}
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
  draft?: LeadMemo;
}

function MemoSlotCard({
  dealId,
  dealTitle,
  slotType,
  title,
  description,
  document,
  draft,
}: MemoSlotCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const documentUrl = useDocumentUrl();
  const generateMemo = useGenerateMemo();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const hasDocument = !!document;
  const hasDraft = !!draft;

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

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadPdf = () => {
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
      await generateMemo.mutateAsync({
        deal_id: dealId,
        memo_type: slotType,
        branding: 'sourceco',
      });
      // Draft is now saved in lead_memos — the query will refetch automatically
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!draft?.content?.sections) return;
    setIsDownloadingDocx(true);
    try {
      await generateMemoDocx({
        sections: draft.content.sections,
        memoType: slotType,
        dealTitle: dealTitle || 'Deal',
        branding: 'SourceCo',
      });
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  const isUploading = uploadDocument.isPending;
  const isDeleting = deleteDocument.isPending;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {hasDraft && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <BookOpen className="h-3 w-3 mr-1" />
                  Draft
                </Badge>
              )}
              {hasDocument && (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Final PDF
                </Badge>
              )}
              {!hasDraft && !hasDocument && (
                <Badge variant="outline" className="text-muted-foreground">
                  No memo
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ─── AI Draft Section ─── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Draft</p>
            {hasDraft ? (
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="h-9 w-9 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {slotType === 'anonymous_teaser' ? 'Anonymous Teaser' : 'Full Lead Memo'} — v{draft.version || 1}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3" />
                      <span>Generated {format(new Date(draft.created_at!), 'MMM d, yyyy h:mm a')}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {draft.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleDownloadDocx}
                    disabled={isDownloadingDocx}
                  >
                    {isDownloadingDocx ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Download .docx
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateDraft}
                    disabled={isGenerating}
                    title="Regenerate draft"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full"
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
            )}
          </div>

          <Separator />

          {/* ─── Final PDF Section ─── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Final PDF</p>
            {hasDocument ? (
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20">
                  <div className="h-9 w-9 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{document.file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3" />
                      <span>Uploaded {format(new Date(document.created_at), 'MMM d, yyyy')}</span>
                      {document.file_size_bytes && (
                        <>
                          <span>·</span>
                          <span>{(document.file_size_bytes / 1024).toFixed(0)} KB</span>
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
                    onClick={handleDownloadPdf}
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
              <div className="space-y-2">
                <div className="flex items-center justify-center py-4 border-2 border-dashed rounded-lg bg-muted/30">
                  <div className="text-center">
                    <FileUp className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
                    <p className="text-xs text-muted-foreground">No final PDF uploaded</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
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
              </div>
            )}
          </div>

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

      {/* Preview Dialog */}
      {draft && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{title} — Draft Preview</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <DraftPreview draft={draft} />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

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

// ─── Draft Preview Component ───

function DraftPreview({ draft }: { draft: LeadMemo }) {
  const sections = draft.content?.sections;

  if (!sections || !Array.isArray(sections)) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No preview available for this draft.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section: any, i: number) => (
        <div key={i}>
          {section.heading && (
            <h3 className="text-sm font-semibold mb-1">{section.heading}</h3>
          )}
          {section.body && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{section.body}</p>
          )}
          {section.bullets && Array.isArray(section.bullets) && (
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 mt-1">
              {section.bullets.map((bullet: string, j: number) => (
                <li key={j}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
