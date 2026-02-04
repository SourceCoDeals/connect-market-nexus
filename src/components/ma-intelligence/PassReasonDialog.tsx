import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface PassReasonDialogProps {
  buyerId: string;
  dealId: string;
  isOpen: boolean;
  onClose: () => void;
  onPass: () => void;
}

const PASS_CATEGORIES = [
  { value: "geography", label: "Geography" },
  { value: "size", label: "Size Criteria" },
  { value: "service_mix", label: "Service Mix" },
  { value: "business_model", label: "Business Model" },
  { value: "owner_goals", label: "Owner Goals" },
  { value: "other", label: "Other" },
];

export function PassReasonDialog({
  buyerId,
  dealId,
  isOpen,
  onClose,
  onPass,
}: PassReasonDialogProps) {
  const [category, setCategory] = useState<string>("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!category || !reason) {
      toast({
        title: "Missing information",
        description: "Please select a category and provide a reason",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if a score record exists
      const { data: existingScore } = await supabase
        .from("buyer_deal_scores")
        .select("id")
        .eq("buyer_id", buyerId)
        .eq("deal_id", dealId)
        .single();

      if (existingScore) {
        // Update existing record
        const { error } = await supabase
          .from("buyer_deal_scores")
          .update({
            passed_on_deal: true,
            passed_at: new Date().toISOString(),
            pass_category: category,
            pass_reason: reason,
            pass_notes: notes || null,
          })
          .eq("id", existingScore.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase.from("buyer_deal_scores").insert({
          buyer_id: buyerId,
          deal_id: dealId,
          passed_on_deal: true,
          passed_at: new Date().toISOString(),
          pass_category: category,
          pass_reason: reason,
          pass_notes: notes || null,
        });

        if (error) throw error;
      }

      toast({
        title: "Passed on deal",
        description: "The buyer has been marked as passed for this deal",
      });

      // Reset form
      setCategory("");
      setReason("");
      setNotes("");
      onPass();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error passing on deal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Pass on Deal</DialogTitle>
          <DialogDescription>
            Record why this buyer is not a good fit for this deal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category">Pass Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {PASS_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Pass Reason</Label>
            <Textarea
              id="reason"
              placeholder="Why is this buyer not a good fit?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional context or notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Pass on Deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
