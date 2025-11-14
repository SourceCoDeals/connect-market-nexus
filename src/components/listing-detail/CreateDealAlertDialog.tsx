import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCreateDealAlert } from '@/hooks/use-deal-alerts';

interface CreateDealAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    title: string;
    category: string;
    location: string;
    revenue: number;
  };
}

export function CreateDealAlertDialog({
  open,
  onOpenChange,
  listing,
}: CreateDealAlertDialogProps) {
  const { mutate: createAlert, isPending } = useCreateDealAlert();
  const [revenueRange, setRevenueRange] = useState<'exact' | 'similar'>('similar');

  const handleCreate = () => {
    const revenueMin = revenueRange === 'similar' ? listing.revenue * 0.5 : listing.revenue * 0.9;
    const revenueMax = revenueRange === 'similar' ? listing.revenue * 1.5 : listing.revenue * 1.1;

    createAlert({
      name: `Similar to ${listing.title}`,
      criteria: {
        categories: [listing.category],
        locations: [listing.location, 'United States'],
        revenueMin,
        revenueMax,
      },
      frequency: 'daily',
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            Notify me of similar opportunities
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Get email notifications when listings matching these criteria are posted
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Category</div>
            <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
              {listing.category}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Location</div>
            <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
              {listing.location} or United States
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Revenue range</div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={revenueRange === 'similar'}
                  onChange={() => setRevenueRange('similar')}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  Similar size (50% smaller to 50% larger)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={revenueRange === 'exact'}
                  onChange={() => setRevenueRange('exact')}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  Very similar (±10%)
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending}
              className="flex-1"
            >
              {isPending ? 'Creating...' : 'Create alert'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
