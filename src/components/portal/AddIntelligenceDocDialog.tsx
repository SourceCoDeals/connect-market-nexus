import { useState } from 'react';
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
import { useCreateIntelligenceDoc } from '@/hooks/portal/use-portal-intelligence';
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

export function AddIntelligenceDocDialog({
  open,
  onOpenChange,
  portalOrgId,
}: AddIntelligenceDocDialogProps) {
  const [docType, setDocType] = useState<IntelligenceDocType>('general_notes');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const createMutation = useCreateIntelligenceDoc();

  const resetForm = () => {
    setDocType('general_notes');
    setTitle('');
    setContent('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createMutation.mutate(
      {
        portal_org_id: portalOrgId,
        doc_type: docType,
        title: title.trim(),
        content: content.trim() || null,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Intelligence Doc</DialogTitle>
            <DialogDescription>
              Add meeting notes, call transcripts, or other intelligence documents.
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
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-content">Content</Label>
              <Textarea
                id="doc-content"
                placeholder="Paste notes, transcript, or any relevant content..."
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
