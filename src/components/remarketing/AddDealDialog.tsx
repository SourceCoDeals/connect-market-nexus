import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Link2, Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";

interface AddDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealCreated?: () => void;
}

const SUPPORTED_EXTENSIONS = ['txt', 'vtt', 'srt', 'pdf', 'doc', 'docx'];
const TEXT_EXTENSIONS = ['txt', 'vtt', 'srt'];
const DOC_EXTENSIONS = ['pdf', 'doc', 'docx'];

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\.[^.]+$/, '');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const AddDealDialog = ({
  open,
  onOpenChange,
  onDealCreated,
}: AddDealDialogProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptFilesRef = useRef<File[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    website: "",
    location: "",
    revenue: "",
    ebitda: "",
    description: "",
    transcriptLink: "",
  });
  const [transcriptFiles, setTranscriptFiles] = useState<File[]>([]);

  // Keep ref in sync for stable closure access during async upload
  const updateFiles = (files: File[]) => {
    setTranscriptFiles(files);
    transcriptFilesRef.current = files;
  };

  // Create new deal mutation
  const createDealMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const insertData = {
        title: formData.title,
        website: formData.website || null,
        location: formData.location || null,
        revenue: formData.revenue ? parseFloat(formData.revenue.replace(/[^0-9.]/g, '')) : null,
        ebitda: formData.ebitda ? parseFloat(formData.ebitda.replace(/[^0-9.]/g, '')) : null,
        description: formData.description || null,
        is_active: true,
        created_by: user?.id,
        category: "Other",
        status: "active",
        is_internal_deal: true,
      };

      const { data: listing, error } = await supabase
        .from("listings")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return { listing, userId: user?.id };
    },
    onSuccess: async ({ listing, userId }) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
      toast.success(`Created "${listing.title}" successfully`);

      // Handle transcript file uploads (use ref for stable reference)
      const filesToUpload = transcriptFilesRef.current;
      if (filesToUpload.length > 0 && userId) {
        const totalFiles = filesToUpload.length;
        let uploaded = 0;

        for (const file of filesToUpload) {
          try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'txt';
            const filePath = `${listing.id}/${Date.now()}-${file.name}`;

            const { error: uploadError } = await supabase.storage
              .from('deal-transcripts')
              .upload(filePath, file);

            if (uploadError) {
              console.error(`Upload error for ${file.name}:`, uploadError);
              toast.error(`Failed to upload ${file.name}`);
              continue;
            }

            const { data: { publicUrl } } = supabase.storage
              .from('deal-transcripts')
              .getPublicUrl(filePath);

            // Extract text content
            let transcriptText = "";
            if (TEXT_EXTENSIONS.includes(fileExt)) {
              transcriptText = await file.text();
            } else if (DOC_EXTENSIONS.includes(fileExt)) {
              // Route through parse-transcript-file for PDF/DOC/DOCX
              try {
                const parseFormData = new FormData();
                parseFormData.append('file', file);
                const { data: parseResult, error: parseError } = await supabase.functions.invoke(
                  'parse-transcript-file',
                  { body: parseFormData }
                );
                if (parseError) {
                  console.error(`Parse error for ${file.name}:`, parseError);
                  transcriptText = "Pending text extraction";
                } else {
                  transcriptText = parseResult?.text || "Pending text extraction";
                }
              } catch (parseErr) {
                console.error(`Parse exception for ${file.name}:`, parseErr);
                transcriptText = "Pending text extraction";
              }
            }

            await supabase.from('deal_transcripts').insert({
              listing_id: listing.id,
              transcript_url: publicUrl,
              transcript_text: transcriptText || "Pending text extraction",
              title: file.name,
              created_by: userId,
              source: 'file_upload',
            });

            uploaded++;
            if (uploaded < totalFiles) {
              toast.info(`Uploaded ${uploaded}/${totalFiles} transcripts...`);
              await sleep(2000); // Rate-limit protection
            }
          } catch (err) {
            console.error(`Transcript handling error for ${file.name}:`, err);
          }
        }

        if (uploaded > 0) {
          toast.success(`${uploaded} transcript${uploaded > 1 ? 's' : ''} uploaded`);
        }
      }

      // Handle transcript link
      if (formData.transcriptLink) {
        try {
          await supabase.from('deal_transcripts').insert({
            listing_id: listing.id,
            transcript_url: formData.transcriptLink,
            transcript_text: "Pending text extraction from link",
            title: "Linked Transcript",
            created_by: userId,
            source: 'link',
          });
          toast.success("Transcript link saved");
        } catch (err) {
          console.error("Transcript link error:", err);
        }
      }

      // Trigger AI enrichment if website provided
      if (listing.website) {
        toast.info("Enriching deal with AI...", { id: `enrich-${listing.id}` });
        supabase.functions.invoke("enrich-deal", {
          body: { dealId: listing.id },
        }).then(({ data, error }) => {
          if (error) {
            console.error("Enrichment error:", error);
            toast.error("Enrichment failed", { id: `enrich-${listing.id}` });
          } else if (data?.success) {
            toast.success(`Enriched with ${data.fieldsUpdated?.length || 0} fields`, { id: `enrich-${listing.id}` });
            queryClient.invalidateQueries({ queryKey: ["listings"] });
            queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
          }
        });
      }

      // Reset form and close
      setFormData({ title: "", website: "", location: "", revenue: "", ebitda: "", description: "", transcriptLink: "" });
      updateFiles([]);
      onDealCreated?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to create deal:", error);
      toast.error("Failed to create deal");
    },
  });

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    // Dedupe by normalized name against existing files
    const existingNames = new Set(transcriptFilesRef.current.map(f => normalizeName(f.name)));
    const uniqueNew = newFiles.filter(f => !existingNames.has(normalizeName(f.name)));

    if (uniqueNew.length < newFiles.length) {
      const skipped = newFiles.length - uniqueNew.length;
      toast.info(`${skipped} duplicate file${skipped > 1 ? 's' : ''} skipped`);
    }

    if (uniqueNew.length > 0) {
      updateFiles([...transcriptFilesRef.current, ...uniqueNew]);
      // Clear link when files are selected
      setFormData(prev => ({ ...prev, transcriptLink: "" }));
    }

    // Reset input so the same file(s) can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    updateFiles(transcriptFilesRef.current.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Deal</DialogTitle>
          <DialogDescription>
            Create a new deal manually. Website is required for AI enrichment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Company Name *</Label>
            <Input
              id="title"
              placeholder="Enter company name"
              value={formData.title}
              onChange={(e) => handleFormChange("title", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website *</Label>
            <Input
              id="website"
              placeholder="https://example.com"
              value={formData.website}
              onChange={(e) => handleFormChange("website", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for AI enrichment to extract company data
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="City, State"
              value={formData.location}
              onChange={(e) => handleFormChange("location", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue</Label>
              <Input
                id="revenue"
                placeholder="$0"
                value={formData.revenue}
                onChange={(e) => handleFormChange("revenue", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ebitda">EBITDA</Label>
              <Input
                id="ebitda"
                placeholder="$0"
                value={formData.ebitda}
                onChange={(e) => handleFormChange("ebitda", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the business..."
              value={formData.description}
              onChange={(e) => handleFormChange("description", e.target.value)}
              rows={3}
            />
          </div>

          {/* Transcript Section */}
          <div className="space-y-3 border-t pt-4">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Call Transcripts (Optional)
            </Label>

            {/* Transcript Link */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="transcriptLink"
                  placeholder="Fireflies, Otter.ai, or other transcript link..."
                  value={formData.transcriptLink}
                  onChange={(e) => handleFormChange("transcriptLink", e.target.value)}
                  disabled={transcriptFiles.length > 0}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 border-t" />
              <span>or</span>
              <div className="flex-1 border-t" />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.vtt,.srt,.pdf,.doc,.docx"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="transcript-file"
              />

              {transcriptFiles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">
                    {transcriptFiles.length} file{transcriptFiles.length > 1 ? 's' : ''} selected
                  </p>
                  {transcriptFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(file.size / 1024).toFixed(0)}KB
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-6 w-6 p-0 shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!formData.transcriptLink}
              >
                <Upload className="h-4 w-4 mr-2" />
                {transcriptFiles.length > 0 ? 'Add More Files' : 'Upload Transcript Files'}
              </Button>

              <p className="text-xs text-muted-foreground">
                Supports .txt, .vtt, .srt, .pdf, .doc, .docx — select multiple files at once
              </p>
            </div>
          </div>

          <Button
            onClick={() => createDealMutation.mutate()}
            disabled={!formData.title || !formData.website || createDealMutation.isPending}
            className="w-full"
          >
            {createDealMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Deal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddDealDialog;
