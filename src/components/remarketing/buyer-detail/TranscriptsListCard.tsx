import { useState, useRef } from "react";
import { FileText, Plus, Sparkles, Link2, Trash2, ChevronDown, Check, Upload, X, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TranscriptStatusBadge } from "@/components/transcripts/TranscriptStatusBadge";

interface Transcript {
  id: string;
  transcript_text: string;
  source?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  processed_at?: string | null;
  extraction_status?: string | null;
  extracted_data?: Record<string, unknown> | null;
  created_at: string;
}

interface TranscriptsListCardProps {
  transcripts: Transcript[];
  buyerId: string;
  onAddTranscript: (text: string, source: string, fileName?: string, fileUrl?: string, triggerExtract?: boolean) => Promise<any> | void;
  onExtract: (transcriptId: string) => void;
  onExtractAll: () => void;
  onDelete: (transcriptId: string) => void;
  isAdding?: boolean;
  isExtracting?: boolean;
}

export const TranscriptsListCard = ({
  transcripts,
  buyerId,
  onAddTranscript,
  onExtract,
  onExtractAll,
  onDelete,
  isAdding = false,
  isExtracting = false,
}: TranscriptsListCardProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  
  // Mode: 'single' for manual entry (link/paste), 'multi' for multi-file upload
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  
  const [formData, setFormData] = useState({
    title: "",
    transcript_link: "",
    call_date: "",
    transcript_text: "",
  });

  const pendingCount = transcripts.filter(t => !t.processed_at).length;

  const parseTranscriptFile = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const { data, error } = await supabase.functions.invoke('parse-transcript-file', {
      body: form as any,
    });
    if (error) throw new Error(error.message || 'Failed to parse file');
    return String((data as any)?.text || '');
  };

  const validateFile = (file: File): boolean => {
    const validTypes = ['.txt', '.pdf', '.doc', '.docx', '.vtt', '.srt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      toast({ title: "Invalid file type", description: `${file.name}: Please upload .txt, .pdf, .doc, .docx, .vtt, or .srt`, variant: "destructive" });
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: `${file.name}: Maximum file size is 10MB`, variant: "destructive" });
      return false;
    }
    return true;
  };

  const addFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(validateFile);
    if (newFiles.length === 0) return;
    
    // Dedupe by name
    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name.toLowerCase()));
      const unique = newFiles.filter(f => !existingNames.has(f.name.toLowerCase()));
      return [...prev, ...unique];
    });
    
    // If adding files, auto-switch to multi mode
    if (newFiles.length > 0) setMode('multi');
    
    // If single file in single mode, set title
    if (newFiles.length === 1 && mode === 'single' && !formData.title) {
      const nameWithoutExt = newFiles[0].name.replace(/\.[^/.]+$/, "");
      setFormData(prev => ({ ...prev, title: nameWithoutExt }));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${buyerId}/${timestamp}_${filename}`;
    const { error } = await supabase.storage.from('buyer-transcripts').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('buyer-transcripts').getPublicUrl(path);
    return publicUrl;
  };

  // Single transcript submit (manual entry mode)
  const handleSubmitSingle = async (triggerExtract: boolean) => {
    if (!formData.title.trim()) {
      toast({ title: "Title required", description: "Please provide a title", variant: "destructive" });
      return;
    }
    if (!formData.transcript_text && !formData.transcript_link && selectedFiles.length === 0) {
      toast({ title: "Content required", description: "Please provide a link, paste content, or upload a file", variant: "destructive" });
      return;
    }

    const file = selectedFiles[0];
    const ext = file ? '.' + file.name.split('.').pop()?.toLowerCase() : '';
    const isPdfOrWord = ['.pdf', '.doc', '.docx'].includes(ext);

    if (triggerExtract && !formData.transcript_text.trim() && !isPdfOrWord) {
      toast({ title: "Can't enrich yet", description: "Paste transcript text or upload a parseable file", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    let fileUrl = formData.transcript_link || undefined;

    try {
      if (file) {
        fileUrl = await uploadFileToStorage(file);
        if (isPdfOrWord && !formData.transcript_text.trim()) {
          setIsParsingFile(true);
          try {
            const extracted = await parseTranscriptFile(file);
            if (extracted.trim()) formData.transcript_text = extracted;
          } catch (err: any) {
            console.warn("PDF parsing failed:", err.message);
          } finally {
            setIsParsingFile(false);
          }
        } else if (['.txt', '.vtt', '.srt'].includes(ext) && !formData.transcript_text.trim()) {
          const text = await file.text();
          formData.transcript_text = text;
        }
      }

      onAddTranscript(formData.transcript_text || "", "call", formData.title.trim(), fileUrl, triggerExtract);
      resetAndClose();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // Multi-file upload (background processing)
  const handleSubmitMulti = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No files selected", description: "Please select files to upload", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const total = selectedFiles.length;
    let successCount = 0;

    // Close dialog immediately, process in background
    const filesToProcess = [...selectedFiles];
    resetAndClose();

    toast({ title: `Uploading ${total} transcripts...`, description: "Processing in background" });

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();

      try {
        // Upload file
        const fileUrl = await uploadFileToStorage(file);

        // Extract text
        let text = '';
        if (['.txt', '.vtt', '.srt'].includes(ext)) {
          text = await file.text();
        } else if (['.pdf', '.doc', '.docx'].includes(ext)) {
          try {
            text = await parseTranscriptFile(file);
          } catch (err: any) {
            console.warn(`Parse failed for ${file.name}:`, err.message);
          }
        }

        await onAddTranscript(text, "call", nameWithoutExt, fileUrl, false);
        successCount++;

        toast({ title: `Uploaded ${i + 1}/${total}`, description: file.name });

        // Delay between files to avoid rate limiting
        if (i < filesToProcess.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (err: any) {
        console.error(`Failed to upload ${file.name}:`, err);
        toast({ title: `Failed: ${file.name}`, description: err.message, variant: "destructive" });
      }
    }

    setIsUploading(false);
    if (successCount > 0) {
      toast({ title: `✅ ${successCount}/${total} transcripts uploaded`, description: "You can now extract intelligence from them" });
    }
  };

  const resetAndClose = () => {
    setFormData({ title: "", transcript_link: "", call_date: "", transcript_text: "" });
    setSelectedFiles([]);
    setMode('single');
    setUploadProgress('');
    setIsDialogOpen(false);
  };

  const handleClose = () => {
    if (!isUploading && !isAdding) resetAndClose();
  };

  const getDisplayName = (transcript: Transcript): string => {
    if (transcript.file_name) return transcript.file_name;
    const source = transcript.source || "transcript";
    const date = new Date(transcript.created_at).toLocaleDateString();
    return `${source.charAt(0).toUpperCase() + source.slice(1)} - ${date}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4" />
            Transcripts & Call Intelligence
          </CardTitle>
          <div className="flex items-center gap-2">
            {transcripts.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onExtractAll}
                disabled={isExtracting || pendingCount === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Re-extract All ({pendingCount})
              </Button>
            )}
            <Button 
              variant="default" 
              size="sm"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Transcript
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {transcripts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">
            No transcripts linked yet.
          </p>
        ) : (
          <div className="space-y-2">
            {transcripts.map((transcript) => (
              <Collapsible 
                key={transcript.id}
                open={expandedId === transcript.id}
                onOpenChange={(open) => setExpandedId(open ? transcript.id : null)}
              >
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {getDisplayName(transcript)}
                    </span>
                    <TranscriptStatusBadge 
                      processedAt={transcript.processed_at} 
                      extractionStatus={transcript.extraction_status}
                    />
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {transcript.file_url && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={transcript.file_url} target="_blank" rel="noopener noreferrer">
                          <Link2 className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {!transcript.processed_at && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onExtract(transcript.id)} disabled={isExtracting}>
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(transcript.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedId === transcript.id ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                
                <CollapsibleContent>
                  <div className="mt-2 p-4 rounded-lg border bg-background">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Transcript Preview</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{transcript.transcript_text}</p>
                    {transcript.extracted_data && Object.keys(transcript.extracted_data).length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Extracted Data</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                          {JSON.stringify(transcript.extracted_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Transcript Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Call Transcript</DialogTitle>
            <DialogDescription>
              Add a single transcript manually, or upload multiple files at once
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`flex-1 text-sm py-1.5 px-3 rounded-md transition-colors ${mode === 'single' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Single Entry
              </button>
              <button
                type="button"
                onClick={() => setMode('multi')}
                className={`flex-1 text-sm py-1.5 px-3 rounded-md transition-colors ${mode === 'multi' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Upload Multiple Files
              </button>
            </div>

            {mode === 'single' ? (
              <>
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="E.g., Q1 2024 Buyer Call"
                  />
                </div>

                {/* Transcript Link */}
                <div className="space-y-2">
                  <Label htmlFor="transcript_link" className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />Transcript Link
                  </Label>
                  <Input
                    id="transcript_link"
                    type="url"
                    value={formData.transcript_link}
                    onChange={(e) => setFormData({ ...formData, transcript_link: e.target.value })}
                    placeholder="https://app.fireflies.ai/view/..."
                  />
                </div>

                {/* Notes / Transcript Content */}
                <div className="space-y-2">
                  <Label htmlFor="transcript_text">Notes / Transcript Content</Label>
                  <Textarea
                    id="transcript_text"
                    value={formData.transcript_text}
                    onChange={(e) => setFormData({ ...formData, transcript_text: e.target.value })}
                    placeholder="Paste transcript content or notes here..."
                    rows={5}
                    className="resize-none"
                  />
                </div>

                {/* Call Date */}
                <div className="space-y-2">
                  <Label htmlFor="call_date" className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />Call Date (optional)
                  </Label>
                  <Input
                    id="call_date"
                    type="date"
                    value={formData.call_date}
                    onChange={(e) => setFormData({ ...formData, call_date: e.target.value })}
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => handleSubmitSingle(false)} disabled={isAdding || isUploading}>
                    Save
                  </Button>
                  <Button type="button" onClick={() => handleSubmitSingle(true)} disabled={isAdding || isUploading || isParsingFile || !formData.transcript_text.trim()}>
                    <Sparkles className="w-4 h-4 mr-2" />Save &amp; Enrich
                  </Button>
                </div>

                {/* OR UPLOAD FILE Divider */}
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-muted" />
                  <span className="px-4 text-xs uppercase tracking-wide text-muted-foreground bg-background">Or Upload File</span>
                  <div className="flex-grow border-t border-muted" />
                </div>
              </>
            ) : null}

            {/* File Upload Zone (shared between modes, but primary in multi mode) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx,.vtt,.srt"
              multiple
              onChange={handleInputChange}
              className="hidden"
            />

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedFiles([])}>
                    Clear all
                  </Button>
                </div>
                {selectedFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeFile(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {mode === 'multi' ? 'Click or drag to add files' : 'Click to upload'}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">.txt, .pdf, .doc, .vtt, .srt</p>
            </div>

            {/* Multi-file upload button */}
            {mode === 'multi' && selectedFiles.length > 0 && (
              <Button
                type="button"
                className="w-full"
                onClick={handleSubmitMulti}
                disabled={isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload {selectedFiles.length} Transcript{selectedFiles.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isAdding || isUploading}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
