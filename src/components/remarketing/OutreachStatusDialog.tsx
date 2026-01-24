import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export type OutreachStatus = 
  | 'pending' 
  | 'contacted' 
  | 'responded' 
  | 'meeting_scheduled' 
  | 'loi_sent' 
  | 'closed_won' 
  | 'closed_lost';

interface OutreachStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerName: string;
  currentStatus?: OutreachStatus;
  onSave: (status: OutreachStatus, notes: string) => Promise<void>;
}

const statusOptions: { value: OutreachStatus; label: string; description: string }[] = [
  { value: 'pending', label: 'Pending', description: 'Not yet contacted' },
  { value: 'contacted', label: 'Contacted', description: 'Initial outreach sent' },
  { value: 'responded', label: 'Responded', description: 'Buyer responded to outreach' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled', description: 'Call/meeting booked' },
  { value: 'loi_sent', label: 'LOI Sent', description: 'Letter of intent sent' },
  { value: 'closed_won', label: 'Closed Won', description: 'Deal completed' },
  { value: 'closed_lost', label: 'Closed Lost', description: 'Did not proceed' },
];

export const OutreachStatusDialog = ({
  open,
  onOpenChange,
  buyerName,
  currentStatus = 'pending',
  onSave,
}: OutreachStatusDialogProps) => {
  const [status, setStatus] = useState<OutreachStatus>(currentStatus);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(status, notes);
      onOpenChange(false);
      setNotes('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Track Outreach</DialogTitle>
          <DialogDescription>
            Update outreach status for <span className="font-medium">{buyerName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OutreachStatus)}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this interaction..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OutreachStatusDialog;
