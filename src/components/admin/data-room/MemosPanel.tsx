/**
 * MemosPanel: AI lead memo generation, editing, and publishing
 *
 * Features:
 * - Generate anonymous teaser or full memo via AI
 * - Rich text editor (TipTap) for section-by-section editing
 * - Branding selection
 * - Publish to data room
 * - Export PDF
 * - Send via email with AI-drafted outreach
 * - Manual log send
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen, Sparkles, FileText, Send, Download, Eye, Edit,
  Loader2, CheckCircle, Clock, Archive,
} from 'lucide-react';
import {
  useLeadMemos,
  useGenerateMemo,
  useUpdateMemo,
  usePublishMemo,
  LeadMemo,
} from '@/hooks/admin/data-room/use-data-room';
import { MemoEditor } from './MemoEditor';
import { SendMemoDialog } from './SendMemoDialog';
import { ManualLogDialog } from './ManualLogDialog';

interface MemosPanelProps {
  dealId: string;
  dealTitle?: string;
}

const BRANDING_OPTIONS = [
  { value: 'sourceco', label: 'SourceCo' },
  { value: 'new_heritage', label: 'New Heritage Capital' },
  { value: 'renovus', label: 'Renovus Capital' },
  { value: 'cortec', label: 'Cortec Group' },
];

const STATUS_BADGES: Record<string, { label: string; icon: any; className: string }> = {
  draft: { label: 'Draft', icon: Edit, className: 'bg-amber-100 text-amber-800' },
  published: { label: 'Published', icon: CheckCircle, className: 'bg-green-100 text-green-800' },
  archived: { label: 'Archived', icon: Archive, className: 'bg-gray-100 text-gray-600' },
};

export function MemosPanel({ dealId, dealTitle }: MemosPanelProps) {
  const { data: memos = [], isLoading } = useLeadMemos(dealId);
  const generateMemo = useGenerateMemo();
  const publishMemo = usePublishMemo();

  const [generateType, setGenerateType] = useState<'anonymous_teaser' | 'full_memo' | 'both'>('both');
  const [branding, setBranding] = useState('sourceco');
  const [editingMemo, setEditingMemo] = useState<LeadMemo | null>(null);
  const [sendingMemo, setSendingMemo] = useState<LeadMemo | null>(null);
  const [loggingMemo, setLoggingMemo] = useState<LeadMemo | null>(null);

  const teaserMemos = memos.filter(m => m.memo_type === 'anonymous_teaser');
  const fullMemos = memos.filter(m => m.memo_type === 'full_memo');

  const handleGenerate = () => {
    generateMemo.mutate({
      deal_id: dealId,
      memo_type: generateType,
      branding,
    });
  };

  const handlePublish = (memoId: string) => {
    publishMemo.mutate({ memoId, dealId });
  };

  const handleExportPdf = (memo: LeadMemo) => {
    // Generate PDF from memo content client-side
    const sections = (memo.content as any)?.sections || [];
    const brandName = BRANDING_OPTIONS.find(b => b.value === memo.branding)?.label || 'SourceCo';
    const isAnonymous = memo.memo_type === 'anonymous_teaser';

    // Build HTML for print
    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lead Memo - ${dealTitle || 'Deal'}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; line-height: 1.6; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; color: #1a1a2e; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1a1a2e; }
          .brand { font-size: 14px; color: #666; }
          .memo-type { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
          .date { font-size: 12px; color: #888; }
          .section { margin-bottom: 20px; }
          ul { padding-left: 20px; }
          li { margin-bottom: 4px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Lead Memo</h1>
          <p class="brand">${brandName}</p>
          <p class="memo-type">${isAnonymous ? 'Anonymous Teaser' : 'Confidential Lead Memo'}</p>
          <p class="date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        ${sections.map((s: any) => `
          <div class="section">
            <h2>${s.title}</h2>
            <div>${s.content.replace(/\n/g, '<br>')}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      // Delay print to allow CSS to load
      setTimeout(() => printWindow.print(), 500);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // If editing a memo, show the editor
  if (editingMemo) {
    return (
      <MemoEditor
        memo={editingMemo}
        dealId={dealId}
        onClose={() => setEditingMemo(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Generate Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Lead Memo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Memo Type</label>
              <Select value={generateType} onValueChange={(v: any) => setGenerateType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anonymous_teaser">Anonymous Teaser</SelectItem>
                  <SelectItem value="full_memo">Full Lead Memo</SelectItem>
                  <SelectItem value="both">Both (Teaser + Full)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Branding</label>
              <Select value={branding} onValueChange={setBranding}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRANDING_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generateMemo.isPending}
            >
              {generateMemo.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            AI will draft from transcripts, enrichment data, and manual entries. You can edit before publishing.
          </p>
        </CardContent>
      </Card>

      {/* Existing Memos */}
      {memos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <BookOpen className="mx-auto h-8 w-8 mb-2" />
            No memos generated yet. Click "Generate" to create an AI draft.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Anonymous Teasers */}
          {teaserMemos.length > 0 && (
            <MemoSection
              title="Anonymous Teasers"
              memos={teaserMemos}
              onEdit={setEditingMemo}
              onPublish={handlePublish}
              onExportPdf={handleExportPdf}
              onSendEmail={setSendingMemo}
              onManualLog={setLoggingMemo}
            />
          )}

          {/* Full Memos */}
          {fullMemos.length > 0 && (
            <MemoSection
              title="Full Lead Memos"
              memos={fullMemos}
              onEdit={setEditingMemo}
              onPublish={handlePublish}
              onExportPdf={handleExportPdf}
              onSendEmail={setSendingMemo}
              onManualLog={setLoggingMemo}
            />
          )}
        </>
      )}

      {/* Send Email Dialog */}
      {sendingMemo && (
        <SendMemoDialog
          memo={sendingMemo}
          dealId={dealId}
          onClose={() => setSendingMemo(null)}
        />
      )}

      {/* Manual Log Dialog */}
      {loggingMemo && (
        <ManualLogDialog
          memo={loggingMemo}
          dealId={dealId}
          onClose={() => setLoggingMemo(null)}
        />
      )}
    </div>
  );
}

// ─── Memo Section Component ───

function MemoSection({
  title,
  memos,
  onEdit,
  onPublish,
  onExportPdf,
  onSendEmail,
  onManualLog,
}: {
  title: string;
  memos: LeadMemo[];
  onEdit: (memo: LeadMemo) => void;
  onPublish: (memoId: string) => void;
  onExportPdf: (memo: LeadMemo) => void;
  onSendEmail: (memo: LeadMemo) => void;
  onManualLog: (memo: LeadMemo) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {memos.map(memo => {
            const statusInfo = STATUS_BADGES[memo.status];
            const StatusIcon = statusInfo.icon;

            return (
              <div key={memo.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {memo.memo_type === 'anonymous_teaser' ? 'Anonymous Teaser' : 'Full Lead Memo'}
                      <span className="text-xs text-muted-foreground ml-1">v{memo.version}</span>
                    </p>
                    <Badge className={statusInfo.className} variant="secondary">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {BRANDING_OPTIONS.find(b => b.value === memo.branding)?.label || memo.branding}
                    {' · '}
                    {new Date(memo.created_at).toLocaleDateString()}
                    {memo.published_at && ` · Published ${new Date(memo.published_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(memo)} title="Edit">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onExportPdf(memo)} title="Export PDF">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onSendEmail(memo)} title="Send via Email">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onManualLog(memo)} title="Log Manual Send">
                    <Clock className="h-3.5 w-3.5" />
                  </Button>
                  {memo.status === 'draft' && (
                    <Button variant="outline" size="sm" onClick={() => onPublish(memo.id)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Publish
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
