import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditInvestmentCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    investmentThesis?: string | null;
    thesisConfidence?: string | null;
  };
  onSave: (data: {
    thesis_summary?: string;
    thesis_confidence?: string;
  }) => void;
  isSaving?: boolean;
}

export const EditInvestmentCriteriaDialog = ({
  open,
  onOpenChange,
  data,
  onSave,
  isSaving = false,
}: EditInvestmentCriteriaDialogProps) => {
  const [formData, setFormData] = useState({
    investmentThesis: data.investmentThesis || "",
    thesisConfidence: data.thesisConfidence || "medium",
  });

  useEffect(() => {
    setFormData({
      investmentThesis: data.investmentThesis || "",
      thesisConfidence: data.thesisConfidence || "medium",
    });
  }, [data]);

  const handleSave = () => {
    onSave({
      thesis_summary: formData.investmentThesis || undefined,
      thesis_confidence: formData.thesisConfidence || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Investment Criteria</DialogTitle>
          <DialogDescription>Update investment thesis and criteria</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="investmentThesis">Investment Thesis</Label>
            <Textarea
              id="investmentThesis"
              placeholder="Describe the investment thesis and acquisition strategy..."
              value={formData.investmentThesis}
              onChange={(e) => setFormData({ ...formData, investmentThesis: e.target.value })}
              rows={4}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Thesis Confidence</Label>
            <Select
              value={formData.thesisConfidence}
              onValueChange={(value) => setFormData({ ...formData, thesisConfidence: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
