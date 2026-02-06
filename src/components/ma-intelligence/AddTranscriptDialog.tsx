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
import { Loader2, Upload, Link2, FileText, X, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddTranscriptDialogProps {
  dealId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdd: () => void;
}

interface SelectedFile {
  file: File;
  title: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
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
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    transcript_link: "",
    call_date: "",
    transcript_text: "",
  });

  const validateFile = (file: File): string | null => {
    const validTypes = ['.txt', '.pdf', '.doc', '.docx', '.vtt', '.srt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      return "Invalid file type. Allowed: .txt, .pdf, .doc, .docx, .vtt, .srt";
    }
    
    if (file.size > 10 * 1024 * 1024) {
      return "File too large (max 10MB)";
    }
    
    return null;
  };

  const handleFilesSelect = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles: SelectedFile[] = [];
    
    Array.from(files).forEach(file => {
      // Check if file already exists
      if (selectedFiles.some(sf => sf.file.name === file.name && sf.file.size === file.size)) {
        return; // Skip duplicates
      }
      
      const error = validateFile(file);
      if (error) {
        toast({
          title: `Error with ${file.name}`,
          description: error,
          variant: "destructive",
        });
        return;
      }
      
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      newFiles.push({
        file,
        title: nameWithoutExt,
        status: 'pending',
      });
    });
    
    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelect(e.target.files);
    // Reset input so same files can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    handleFilesSelect(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileTitle = (index: number, title: string) => {
    setSelectedFiles(prev => prev.map((sf, i) => 
      i === index ? { ...sf, title } : sf
    ));
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

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // If we have files selected, process them
      if (selectedFiles.length > 0) {
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const sf = selectedFiles[i];
          
          // Update status to uploading
          setSelectedFiles(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'uploading' } : item
          ));
          
          try {
            let fileUrl: string | null = null;
            let transcriptText = '';
            
            // Upload file
            try {
              fileUrl = await uploadFileToStorage(sf.file);
            } catch (uploadError: any) {
              console.warn("File upload failed:", uploadError.message);
            }
            
            // Read text content for text-based files
            const ext = '.' + sf.file.name.split('.').pop()?.toLowerCase();
            if (['.txt', '.vtt', '.srt'].includes(ext)) {
              try {
                transcriptText = await readFileAsText(sf.file);
              } catch {
                // Ignore read errors
              }
            }
            
            // MIGRATION FIX: Insert into unified transcripts table with entity_type
            const { error } = await supabase.from("transcripts").insert({
              entity_type: "deal",
              listing_id: dealId,
              title: sf.title.trim() || sf.file.name,
              source: "call",
              transcript_url: fileUrl,
              call_date: formData.call_date || null,
              transcript_text: transcriptText,
            });
            
            if (error) throw error;
            
            setSelectedFiles(prev => prev.map((item, idx) => 
              idx === i ? { ...item, status: 'success' } : item
            ));
            successCount++;
          } catch (err: any) {
            setSelectedFiles(prev => prev.map((item, idx) => 
              idx === i ? { ...item, status: 'error', error: err.message } : item
            ));
            errorCount++;
          }
        }
        
        if (successCount > 0) {
          toast({
            title: `${successCount} transcript${successCount > 1 ? 's' : ''} added`,
            description: errorCount > 0 ? `${errorCount} failed` : undefined,
          });
          onAdd();
        }
        
        if (errorCount === 0) {
          // Reset and close only if all succeeded
          setFormData({
            title: "",
            transcript_link: "",
            call_date: "",
            transcript_text: "",
          });
          setSelectedFiles([]);
          onClose();
        }
      } else {
        // Handle link/text-only submission (original behavior)
        if (!formData.title.trim()) {
          throw new Error("Title is required");
        }

        if (!formData.transcript_text && !formData.transcript_link) {
          throw new Error("Please provide a transcript link, paste content, or upload files");
        }

        // MIGRATION FIX: Insert into unified transcripts table with entity_type
        const { error } = await supabase.from("transcripts").insert({
          entity_type: "deal",
          listing_id: dealId,
          title: formData.title.trim(),
          source: "call",
          transcript_url: formData.transcript_link || null,
          call_date: formData.call_date || null,
          transcript_text: formData.transcript_text || "",
        });

        if (error) throw error;

        toast({
          title: "Transcript added",
          description: "The transcript has been added successfully",
        });

        setFormData({
          title: "",
          transcript_link: "",
          call_date: "",
          transcript_text: "",
        });
        setSelectedFiles([]);

        onAdd();
        onClose();
      }
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
      setSelectedFiles([]);
      onClose();
    }
  };

  const hasFilesSelected = selectedFiles.length > 0;
  const allFilesProcessed = selectedFiles.every(f => f.status === 'success' || f.status === 'error');

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Call Transcript</DialogTitle>
          <DialogDescription>
            Add a transcript from a call. AI will extract key information about the deal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Title - only show if no files selected */}
            {!hasFilesSelected && (
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Discovery Call - Jan 15"
                />
              </div>
            )}

            {/* Transcript Link - only show if no files selected */}
            {!hasFilesSelected && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="transcript_link" className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    Transcript Link URL
                  </Label>
                  <Input
                    id="transcript_link"
                    type="url"
                    value={formData.transcript_link}
                    onChange={(e) =>
                      setFormData({ ...formData, transcript_link: e.target.value })
                    }
                    placeholder="e.g., https://app.fireflies.ai/view/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="call_date" className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Call Date
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
              </div>
            )}

            {/* Notes / Transcript Content - only show if no files selected */}
            {!hasFilesSelected && (
              <div className="space-y-2">
                <Label htmlFor="transcript_text">Notes / Transcript Content</Label>
                <Textarea
                  id="transcript_text"
                  value={formData.transcript_text}
                  onChange={(e) =>
                    setFormData({ ...formData, transcript_text: e.target.value })
                  }
                  placeholder="Paste the call transcript or notes here..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            )}

            {/* File Upload Zone */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx,.vtt,.srt"
              multiple
              onChange={handleInputChange}
              className="hidden"
            />
            
            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Files to Upload ({selectedFiles.length})</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Add More
                  </Button>
                </Label>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2 pr-2">
                    {selectedFiles.map((sf, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
                        {sf.status === 'pending' && (
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        {sf.status === 'uploading' && (
                          <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
                        )}
                        {sf.status === 'success' && (
                          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                        {sf.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          {sf.status === 'pending' && !isSubmitting ? (
                            <Input
                              value={sf.title}
                              onChange={(e) => updateFileTitle(index, e.target.value)}
                              className="h-7 text-sm"
                              placeholder="Title"
                            />
                          ) : (
                            <span className="text-sm truncate block">{sf.title}</span>
                          )}
                          {sf.status === 'error' && sf.error && (
                            <span className="text-xs text-destructive">{sf.error}</span>
                          )}
                        </div>
                        
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(sf.file.size / 1024).toFixed(0)} KB
                        </span>
                        
                        {sf.status === 'pending' && !isSubmitting && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Drop Zone - always visible */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
              <p className="text-sm text-muted-foreground">
                {hasFilesSelected ? "Drop more files or click to add" : "Or upload a file instead"}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Supports PDF, TXT, DOC, DOCX (max 10MB)
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || (allFilesProcessed && selectedFiles.length > 0)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>Add Transcript{selectedFiles.length > 1 ? 's' : ''}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
