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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Link2, FileText, X, Calendar } from "lucide-react";

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
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    transcript_link: "",
    call_date: "",
    transcript_text: "",
  });

  const handleFileSelect = (file: File) => {
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
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${dealId}/${timestamp}_${filename}`;
    
    const { error } = await supabase.storage
      .from('deal-transcripts')
      .upload(path, file);
      
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('deal-transcripts')
      .getPublicUrl(path);
      
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.title.trim()) {
        throw new Error("Title is required");
      }

      if (!formData.transcript_text && !formData.transcript_link && !selectedFile) {
        throw new Error("Please provide a transcript link, paste content, or upload a file");
      }

      let fileUrl = formData.transcript_link || null;

      // Upload file to storage if selected
      if (selectedFile) {
        try {
          fileUrl = await uploadFileToStorage(selectedFile);
        } catch (uploadError: any) {
          // If bucket doesn't exist, just use the link if provided
          console.warn("File upload failed:", uploadError.message);
          if (!formData.transcript_link && !formData.transcript_text) {
            throw new Error("File upload failed. Please paste the content or provide a link instead.");
          }
        }
      }

      // Insert into deal_transcripts table
      const { error } = await supabase.from("deal_transcripts").insert({
        listing_id: dealId,
        title: formData.title.trim(),
        source: "call", // Default source
        transcript_url: fileUrl,
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
        transcript_link: "",
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
        transcript_link: "",
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
          <DialogTitle>Add Call Transcript</DialogTitle>
          <DialogDescription>
            Add a transcript link, paste content, or upload a file
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="E.g., Q1 2024 Buyer Call"
              />
            </div>

            {/* Transcript Link */}
            <div className="space-y-2">
              <Label htmlFor="transcript_link" className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Transcript Link
              </Label>
              <Input
                id="transcript_link"
                type="url"
                value={formData.transcript_link}
                onChange={(e) =>
                  setFormData({ ...formData, transcript_link: e.target.value })
                }
                placeholder="https://app.fireflies.ai/view/..."
              />
            </div>

            {/* Notes / Transcript Content */}
            <div className="space-y-2">
              <Label htmlFor="transcript_text">Notes / Transcript Content</Label>
              <Textarea
                id="transcript_text"
                value={formData.transcript_text}
                onChange={(e) =>
                  setFormData({ ...formData, transcript_text: e.target.value })
                }
                placeholder="Paste transcript content or notes here..."
                rows={5}
                className="resize-none"
              />
            </div>

            {/* Call Date */}
            <div className="space-y-2">
              <Label htmlFor="call_date" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Call Date (optional)
              </Label>
              <Input
                id="call_date"
                type="date"
                value={formData.call_date}
                onChange={(e) =>
                  setFormData({ ...formData, call_date: e.target.value })
                }
              />
            </div>

            {/* Primary Submit Button */}
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Add Transcript Link
            </Button>

            {/* OR UPLOAD FILE Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-muted" />
              <span className="px-4 text-xs uppercase tracking-wide text-muted-foreground bg-background">
                Or Upload File
              </span>
              <div className="flex-grow border-t border-muted" />
            </div>

            {/* File Upload Zone */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx,.vtt,.srt"
              onChange={handleInputChange}
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
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  .txt, .pdf, .doc, .vtt, .srt
                </p>
              </div>
            )}
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
