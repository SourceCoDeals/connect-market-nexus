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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface PassReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerName: string;
  onConfirm: (reason: string, category: string, notes?: string) => void;
  isLoading?: boolean;
}

const PASS_REASONS = [
  { value: 'not_a_fit', label: 'Not a fit', description: 'Buyer criteria don\'t align with this deal' },
  { value: 'size_mismatch', label: 'Size mismatch', description: 'Deal size outside buyer\'s target range' },
  { value: 'geography', label: 'Geography issue', description: 'Location doesn\'t match buyer targets' },
  { value: 'already_contacted', label: 'Already contacted', description: 'Buyer has been approached before' },
  { value: 'timing', label: 'Timing issue', description: 'Buyer not actively looking right now' },
  { value: 'other', label: 'Other', description: 'Specify reason in notes' },
] as const;

export const PassReasonDialog = ({
  open,
  onOpenChange,
  buyerName,
  onConfirm,
  isLoading = false,
}: PassReasonDialogProps) => {
  const [selectedReason, setSelectedReason] = useState<string>('not_a_fit');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    const reason = PASS_REASONS.find(r => r.value === selectedReason);
    onConfirm(reason?.label || 'Other', selectedReason, notes || undefined);
    setSelectedReason('not_a_fit');
    setNotes('');
  };

  const handleClose = () => {
    setSelectedReason('not_a_fit');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <X className="h-5 w-5 text-red-500" />
            Pass on {buyerName}
          </DialogTitle>
          <DialogDescription>
            Help improve future matching by telling us why this buyer isn't a fit.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            {PASS_REASONS.map((reason) => (
              <div 
                key={reason.value}
                className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                onClick={() => setSelectedReason(reason.value)}
              >
                <RadioGroupItem value={reason.value} id={reason.value} className="mt-0.5" />
                <Label htmlFor={reason.value} className="cursor-pointer flex-1">
                  <span className="font-medium">{reason.label}</span>
                  <p className="text-sm text-muted-foreground">{reason.description}</p>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div>
            <Label htmlFor="notes" className="text-sm font-medium">
              Additional Notes (optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any additional context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? 'Saving...' : 'Confirm Pass'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PassReasonDialog;
