import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Loader2, Paperclip, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCreateIntelligenceDoc } from '@/hooks/portal/use-portal-intelligence';
import { useListingSearch, useListingLabel } from '@/hooks/portal/use-listing-search';
import { AsyncCombobox } from '@/components/ui/async-combobox';
import type { IntelligenceDocType } from '@/types/portal';

interface AddIntelligenceDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalOrgId: string;
}

const DOC_TYPE_OPTIONS: { value: IntelligenceDocType; label: string }[] = [
  { value: 'meeting_notes', label: 'Meeting Notes' },
  { value: 'call_transcript', label: 'Call Transcript' },
  { value: 'general_notes', label: 'General Notes' },
  { value: 'pass_notes', label: 'Pass Notes' },
  { value: 'thesis_document', label: 'Thesis Document' },
];

const BUCKET_NAME = 'portal-intelligence-docs';
const MAX_CONTENT = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // Matches bucket file_size_limit

export function AddIntelligenceDocDialog({
  open,
  onOpenChange,
  portalOrgId,
}: AddIntelligenceDocDialogProps) {
  const [docType, setDocType] = useState<IntelligenceDocType>('general_notes');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [firefliesId, setFirefliesId] = useState('');
  const [listingId, setListingId] = useState<string | null>(null);
  const [listingSearch, setListingSearch] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { options: listingOptions, isLoading: listingLoading } = useListingSearch(listingSearch);
  const { data: listingLabel } = useListingLabel(listingId);

  const createMutation = useCreateIntelligenceDoc();

  const resetForm = () => {
    setDocType('general_notes');
    setTitle('');
    setContent('');
    setFirefliesId('');
    setListingId(null);
    setListingSearch('');
    setFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_BYTES) {
      setUploadError(`File is too large. Max ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || createMutation.isPending || isUploading) return;

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;

    // Upload the file first (if present), then insert the row.
    if (file) {
      setIsUploading(true);
      setUploadError(null);
      try {
        // Path: {portal_org_id}/{timestamp}-{sanitized filename}
        const sanitized = file.name.replace(/[^\w.-]/g, '_');
        const path = `${portalOrgId}/${Date.now()}-${sanitized}`;
        const { error: uploadErr } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });
        if (uploadErr) throw uploadErr;

        fileUrl = path; // Store the bucket path; signed URL generated on read.
        fileName = file.name;
        fileType = file.type || null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(msg);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    createMutation.mutate(
      {
        portal_org_id: portalOrgId,
        doc_type: docType,
        title: title.trim(),
        content: content.trim() || null,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        fireflies_transcript_id: firefliesId.trim() || null,
        listing_id: listingId,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      },
    );
  };

  const submitDisabled = !title.trim() || createMutation.isPending || isUploading;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Intelligence Doc</DialogTitle>
            <DialogDescription>
              Attach meeting notes, transcripts, thesis docs, or files.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc-type">Type</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as IntelligenceDocType)}>
                <SelectTrigger id="doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                placeholder="e.g. Q1 Strategy Call with John"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-content">Content</Label>
              <Textarea
                id="doc-content"
                placeholder="Paste notes, transcript, or any relevant content..."
                rows={8}
                maxLength={MAX_CONTENT}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-right">
                {content.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-file">Attach file (optional)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  id="doc-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md,.mp3,.m4a,.wav,.webm"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1" />
                  {file ? 'Change file' : 'Choose file'}
                </Button>
                {file && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <span>({(file.size / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      aria-label="Remove file"
                      className="ml-1 rounded hover:bg-accent p-0.5"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                PDF, Word, text, markdown, or audio. Max 25 MB.
              </p>
              {uploadError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-fireflies">Fireflies transcript ID (optional)</Label>
              <Input
                id="doc-fireflies"
                placeholder="e.g. abc123xyz"
                value={firefliesId}
                onChange={(e) => setFirefliesId(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Paste the transcript ID from Fireflies so we can link back later.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Link to Deal (optional)</Label>
              <AsyncCombobox
                value={listingId}
                onValueChange={(v) => setListingId(v)}
                options={listingOptions}
                onSearchChange={setListingSearch}
                isLoading={listingLoading}
                selectedLabel={listingLabel}
                placeholder="No deal linked"
                searchPlaceholder="Search deals..."
                emptyText="No matching deals"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending || isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {(createMutation.isPending || isUploading) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isUploading ? 'Uploading...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
