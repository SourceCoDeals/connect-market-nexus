import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSavedStatus, useSaveListingMutation } from '@/hooks/marketplace/use-saved-listings';
import { useListingSaveCount } from '@/hooks/use-collections';
import { SaveToCollectionDialog } from './SaveToCollectionDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface EnhancedSaveButtonProps {
  listingId: string;
  onSave?: () => void;
}

export function EnhancedSaveButton({ listingId, onSave }: EnhancedSaveButtonProps) {
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const { data: isSaved } = useSavedStatus(listingId);
  const { data: saveCount } = useListingSaveCount(listingId);
  const { mutate: toggleSave, isPending } = useSaveListingMutation();

  const handleQuickSave = () => {
    toggleSave(
      {
        listingId,
        action: isSaved ? 'unsave' : 'save',
      },
      {
        onSuccess: () => {
          onSave?.();
        },
      }
    );
  };

  const handleSaveToCollection = () => {
    setShowCollectionDialog(true);
  };

  return (
    <>
      <div className="space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={isSaved ? 'default' : 'outline'}
              size="sm"
              disabled={isPending}
              className={isSaved ? 'bg-foreground text-background hover:bg-foreground/90' : ''}
            >
              {isSaved ? 'Saved' : 'Save listing'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleQuickSave}>
              {isSaved ? 'Remove from saved' : 'Quick save'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSaveToCollection}>
              Save to collection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {saveCount !== undefined && saveCount > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {saveCount} {saveCount === 1 ? 'buyer has' : 'buyers have'} saved this
          </p>
        )}
      </div>

      <SaveToCollectionDialog
        open={showCollectionDialog}
        onOpenChange={setShowCollectionDialog}
        listingId={listingId}
        onSaveComplete={onSave}
      />
    </>
  );
}
