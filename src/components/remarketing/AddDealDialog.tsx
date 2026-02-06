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

export const AddDealDialog = ({
  open,
  onOpenChange,
  onDealCreated,
}: AddDealDialogProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    website: "",
    location: "",
    revenue: "",
    ebitda: "",
    description: "",
    transcriptLink: "",
  });
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);

  // Create new deal mutation
  const createDealMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const insertData: {
        title: string;
        website: string | null;
        location: string | null;
        revenue: number | null;
        ebitda: number | null;
        description: string | null;
        is_active: boolean;
        created_by: string | undefined;
        category: string;
        status: string;
        is_internal_deal: boolean;
      } = {
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
      
      // Handle transcript file upload
      if (transcriptFile && userId) {
        try {
          const fileExt = transcriptFile.name.split('.').pop();
          const filePath = `${listing.id}/${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('deal-transcripts')
            .upload(filePath, transcriptFile);
          
          if (uploadError) {
            console.error("Transcript upload error:", uploadError);
            toast.error("Failed to upload transcript file");
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('deal-transcripts')
              .getPublicUrl(filePath);
            
            // Read file content if it's a text file
            let transcriptText = "";
            if (['txt', 'vtt', 'srt'].includes(fileExt?.toLowerCase() || '')) {
              transcriptText = await transcriptFile.text();
            }
            
            // Save transcript record
            await supabase.from('deal_transcripts').insert({
              listing_id: listing.id,
              transcript_url: publicUrl,
              transcript_text: transcriptText || "Pending text extraction",
              title: transcriptFile.name,
              created_by: userId,
              source: 'file_upload',
            });
            
            toast.success("Transcript uploaded");
          }
        } catch (err) {
          console.error("Transcript handling error:", err);
        }
      }
      
      // Handle transcript link
      if (formData.transcriptLink) {
        try {
          // Save transcript link
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
      setTranscriptFile(null);
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
    const file = e.target.files?.[0];
    if (file) {
      setTranscriptFile(file);
      // Clear link if file is selected
      setFormData(prev => ({ ...prev, transcriptLink: "" }));
    }
  };

  const clearFile = () => {
    setTranscriptFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
              Call Transcript (Optional)
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
                  disabled={!!transcriptFile}
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
                onChange={handleFileChange}
                className="hidden"
                id="transcript-file"
              />
              
              {transcriptFile ? (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm flex-1 truncate">{transcriptFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!formData.transcriptLink}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Transcript File
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Supports .txt, .vtt, .srt, .pdf, .doc, .docx
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
