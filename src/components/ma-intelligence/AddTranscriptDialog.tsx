import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Link2, FileText, X } from "lucide-react";

interface AddTranscriptDialogProps {
  dealId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdd: () => void;
}

export function AddTranscriptDialog({
  dealId,
  isOpen,
  onClose,
  onAdd,
}: AddTranscriptDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    source: "call" as string,
    fireflies_url: "",
    call_date: "",
    transcript_text: "",
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['.txt', '.pdf', '.doc', '.docx', '.vtt', '.srt'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!validTypes.includes(ext)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a .txt, .pdf, .doc, .docx, .vtt, or .srt file",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
      
      // Auto-fill title from filename if empty
      if (!formData.title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setFormData(prev => ({ ...prev, title: nameWithoutExt }));
      }
      
      // If it's a text file, read and populate the transcript text
      if (ext === '.txt' || ext === '.vtt' || ext === '.srt') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setFormData(prev => ({ ...prev, transcript_text: text }));
        };
        reader.readAsText(file);
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.title) {
        throw new Error("Title is required");
      }

      if (!formData.transcript_text && !formData.fireflies_url && !selectedFile) {
        throw new Error("Please provide transcript text, a Fireflies link, or upload a file");
      }

      // Insert into deal_transcripts table (uses listing_id, not deal_id)
      const { error } = await supabase.from("deal_transcripts").insert({
        listing_id: dealId,
        title: formData.title,
        source: formData.source,
        transcript_url: formData.fireflies_url || null,
        call_date: formData.call_date || null,
        transcript_text: formData.transcript_text || "",
      });

      if (error) throw error;

      toast({
        title: "Transcript added",
        description: "The transcript has been added successfully",
      });

      // Reset form
      setFormData({
        title: "",
        source: "call",
        fireflies_url: "",
        call_date: "",
        transcript_text: "",
      });
      setSelectedFile(null);

      onAdd();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error adding transcript",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        title: "",
        source: "call",
        fireflies_url: "",
        call_date: "",
        transcript_text: "",
      });
      setSelectedFile(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transcript</DialogTitle>
          <DialogDescription>
            Paste a call transcript or meeting notes to extract buyer intelligence
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Source Type and File Name Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="source">Source Type</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) =>
                    setFormData({ ...formData, source: value })
                  }
                >
                  <SelectTrigger id="source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="email">Email Thread</SelectItem>
                    <SelectItem value="fireflies">Fireflies</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">File Name (optional)</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Q1-Call-Notes.pdf"
                />
              </div>
            </div>

            {/* Fireflies Link */}
            <div className="space-y-2">
              <Label htmlFor="fireflies_url" className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Fireflies Link (optional)
              </Label>
              <Input
                id="fireflies_url"
                type="url"
                value={formData.fireflies_url}
                onChange={(e) =>
                  setFormData({ ...formData, fireflies_url: e.target.value })
                }
                placeholder="https://app.fireflies.ai/view/..."
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Upload Transcript File
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.doc,.docx,.vtt,.srt"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={clearFile}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose file (.txt, .pdf, .doc, .vtt, .srt)
                </Button>
              )}
            </div>

            {/* Transcript Text */}
            <div className="space-y-2">
              <Label htmlFor="transcript_text">Transcript Text</Label>
              <Textarea
                id="transcript_text"
                value={formData.transcript_text}
                onChange={(e) =>
                  setFormData({ ...formData, transcript_text: e.target.value })
                }
                placeholder="Paste your call transcript, meeting notes, or email content here..."
                rows={6}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Transcript
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}