import { useState, useRef } from "react";
import { FileText, Plus, Sparkles, Link2, Trash2, ChevronDown, Check, Upload, X, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface Transcript {
  id: string;
  transcript_text: string;
  source?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  processed_at?: string | null;
  extracted_data?: Record<string, unknown> | null;
  created_at: string;
}

interface TranscriptsListCardProps {
  transcripts: Transcript[];
  buyerId: string;
  onAddTranscript: (text: string, source: string, fileName?: string, fileUrl?: string, triggerExtract?: boolean) => void;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  
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
      // supabase-js will send multipart form-data for FormData bodies
      body: form as any,
    });

    if (error) {
      throw new Error(error.message || 'Failed to parse file');
    }

    return String((data as any)?.text || '');
  };

  const handleFileSelect = async (file: File) => {
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
    
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFile(file);
    
    if (!formData.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setFormData(prev => ({ ...prev, title: nameWithoutExt }));
    }

    // Extract text content for text-based formats locally
    if (ext === '.txt' || ext === '.vtt' || ext === '.srt') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        setFormData(prev => ({ ...prev, transcript_text: text }));
      };
      reader.readAsText(file);
      return;
    }

    // FIX #3: For PDFs/Word, just show a message - parsing happens AFTER upload
    if (ext === '.pdf' || ext === '.doc' || ext === '.docx') {
      toast({
        title: "PDF/Word file selected",
        description: "Text extraction will happen after upload. File is ready to save.",
      });
      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
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
    if (file) handleFileSelect(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${buyerId}/${timestamp}_${filename}`;
    
    const { error } = await supabase.storage
      .from('buyer-transcripts')
      .upload(path, file);
      
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('buyer-transcripts')
      .getPublicUrl(path);
      
    return publicUrl;
  };

  const handleSubmit = async (triggerExtract: boolean) => {
    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Please provide a title for the transcript",
        variant: "destructive",
      });
      return;
    }

    if (!formData.transcript_text && !formData.transcript_link && !selectedFile) {
      toast({
        title: "Content required",
        description: "Please provide a transcript link, paste content, or upload a file",
        variant: "destructive",
      });
      return;
    }

    // FIX #3: Allow "Save & Enrich" for PDFs even without text (we'll parse after upload)
    const ext = selectedFile ? '.' + selectedFile.name.split('.').pop()?.toLowerCase() : '';
    const isPdfOrWord = ['.pdf', '.doc', '.docx'].includes(ext);

    if (triggerExtract && !formData.transcript_text.trim() && !isPdfOrWord) {
      toast({
        title: "Can't enrich yet",
        description: "We need transcript text to extract intelligence. Paste the transcript, or upload a file we can extract text from.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    let fileUrl = formData.transcript_link || undefined;

    try {
      // FIX #3: Upload file FIRST, then parse PDF if needed
      if (selectedFile) {
        try {
          fileUrl = await uploadFileToStorage(selectedFile);

          // Parse PDF/Word AFTER successful upload
          const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
          if (['.pdf', '.doc', '.docx'].includes(ext) && !formData.transcript_text.trim()) {
            setIsParsingFile(true);
            try {
              const extracted = await parseTranscriptFile(selectedFile);
              if (extracted.trim()) {
                formData.transcript_text = extracted;
                toast({
                  title: "Text extracted from file",
                  description: `Extracted ${extracted.length} characters`,
                });
              } else {
                console.warn("No text extracted from PDF/Word file");
                toast({
                  title: "PDF uploaded without text",
                  description: "File saved, but no text could be extracted. You can paste content manually if needed.",
                });
              }
            } catch (parseErr: any) {
              console.warn("PDF parsing failed after upload:", parseErr.message);
              toast({
                title: "File uploaded",
                description: "Text extraction failed, but file is saved. You can paste content manually.",
              });
            } finally {
              setIsParsingFile(false);
            }
          }
        } catch (uploadError: any) {
          console.warn("File upload failed:", uploadError.message);
          if (!formData.transcript_link && !formData.transcript_text) {
            throw new Error(
              "File upload failed. Please paste the content or provide a link instead."
            );
          }
        }
      }

      onAddTranscript(
        formData.transcript_text || "",
        "call",
        formData.title.trim(),
        fileUrl,
        triggerExtract
      );

      setFormData({
        title: "",
        transcript_link: "",
        call_date: "",
        transcript_text: "",
      });
      setSelectedFile(null);
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error adding transcript",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading && !isAdding) {
      setFormData({
        title: "",
        transcript_link: "",
        call_date: "",
        transcript_text: "",
      });
      setSelectedFile(null);
      setIsDialogOpen(false);
    }
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
                    {transcript.processed_at && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Check className="mr-1 h-3 w-3" />
                        Extracted
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {transcript.file_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        asChild
                      >
                        <a href={transcript.file_url} target="_blank" rel="noopener noreferrer">
                          <Link2 className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {!transcript.processed_at && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onExtract(transcript.id)}
                        disabled={isExtracting}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(transcript.id)}
                    >
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
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Transcript Preview
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                      {transcript.transcript_text}
                    </p>
                    {transcript.extracted_data && Object.keys(transcript.extracted_data).length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Extracted Data
                        </p>
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
              Add a transcript link, paste content, or upload a file
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
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
                <Link2 className="h-3.5 w-3.5" />
                Transcript Link
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
                <Calendar className="h-3.5 w-3.5" />
                Call Date (optional)
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
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={isAdding || isUploading}
              >
                Save
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isAdding || isUploading || isParsingFile || !formData.transcript_text.trim()}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Save &amp; Enrich
              </Button>
            </div>

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
            <Button variant="outline" onClick={handleClose} disabled={isAdding || isUploading}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
