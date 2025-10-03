import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface TaskStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: string;
  onStatusChange: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'bg-gray-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-500' },
  { value: 'reopened', label: 'Reopened', color: 'bg-purple-500' },
  { value: 'na', label: 'NA', color: 'bg-gray-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-emerald-500' },
];

export function TaskStatusDialog({ open, onOpenChange, currentStatus, onStatusChange }: TaskStatusDialogProps) {
  const handleStatusSelect = (status: string) => {
    onStatusChange(status);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set status</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 py-4">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusSelect(option.value)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${option.color}`} />
                <span className="text-sm text-foreground">{option.label}</span>
              </div>
              {currentStatus === option.value && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
