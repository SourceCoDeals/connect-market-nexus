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
    source: "call" as string,
    transcript_url: "",
    call_date: "",
    transcript_text: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.title) {
        throw new Error("Title is required");
      }

      // Insert into deal_transcripts table (uses listing_id, not deal_id)
      const { error } = await supabase.from("deal_transcripts").insert({
        listing_id: dealId,
        title: formData.title,
        source: formData.source,
        transcript_url: formData.transcript_url || null,
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
        transcript_url: "",
        call_date: "",
        transcript_text: "",
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
        source: "call",
        transcript_url: "",
        call_date: "",
        transcript_text: "",
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
              <Label htmlFor="source">Source</Label>
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
                  <SelectItem value="call">Call Recording</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email Thread</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transcript_url">Transcript URL (optional)</Label>
              <Input
                id="transcript_url"
                type="url"
                value={formData.transcript_url}
                onChange={(e) =>
                  setFormData({ ...formData, transcript_url: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

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
              <Label htmlFor="transcript_text">Transcript Text</Label>
              <Textarea
                id="transcript_text"
                value={formData.transcript_text}
                onChange={(e) =>
                  setFormData({ ...formData, transcript_text: e.target.value })
                }
                placeholder="Paste transcript content here..."
                rows={5}
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
