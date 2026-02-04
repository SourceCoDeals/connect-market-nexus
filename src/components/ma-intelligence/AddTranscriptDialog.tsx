import { useState } from "react";
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
import { Loader2, Upload } from "lucide-react";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "Link" as "Link" | "Upload" | "Call",
    url: "",
    call_date: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.title) {
        throw new Error("Title is required");
      }
      if (formData.type === "Link" && !formData.url) {
        throw new Error("URL is required for Link type");
      }

      // Insert into deal_transcripts table
      const { error } = await supabase.from("deal_transcripts").insert({
        deal_id: dealId,
        title: formData.title,
        type: formData.type,
        url: formData.type === "Link" ? formData.url : null,
        call_date: formData.call_date || null,
        notes: formData.notes || null,
        processed_status: "Pending",
      });

      if (error) throw error;

      toast({
        title: "Transcript added",
        description: "The transcript has been added successfully",
      });

      // Reset form
      setFormData({
        title: "",
        type: "Link",
        url: "",
        call_date: "",
        notes: "",
      });

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
        type: "Link",
        url: "",
        call_date: "",
        notes: "",
      });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Transcript</DialogTitle>
          <DialogDescription>
            Add a new transcript or call recording for this deal
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Initial Discovery Call"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "Link" | "Upload" | "Call") =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Link">Link (URL)</SelectItem>
                  <SelectItem value="Upload">Upload File</SelectItem>
                  <SelectItem value="Call">Call Recording</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === "Link" && (
              <div className="space-y-2">
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://..."
                  required
                />
              </div>
            )}

            {formData.type === "Upload" && (
              <div className="space-y-2">
                <Label htmlFor="file">Upload File</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    File upload coming soon
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="call_date">Call Date</Label>
              <Input
                id="call_date"
                type="date"
                value={formData.call_date}
                onChange={(e) =>
                  setFormData({ ...formData, call_date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Add any additional notes..."
                rows={3}
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
