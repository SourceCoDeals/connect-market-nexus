import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSavedStatus, useSaveListingMutation } from '@/hooks/marketplace/use-saved-listings';
import { useListingSaveCount } from '@/hooks/use-collections';
import { SaveToCollectionDialog } from './SaveToCollectionDialog';

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
        {/* Direct save button */}
        <Button
          variant="outline"
          size="lg"
          onClick={handleQuickSave}
          disabled={isPending}
          className="w-full h-11 border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-900 font-medium text-[15px] tracking-[0.01em] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2"
        >
          {isSaved ? 'Saved' : 'Save'}
        </Button>
        
        {/* Save to collection as subtle secondary action */}
        {isSaved && (
          <button
            onClick={handleSaveToCollection}
            className="text-xs text-slate-500 hover:text-slate-700 underline decoration-slate-300 hover:decoration-slate-500 underline-offset-2 transition-colors font-normal w-full text-center"
          >
            Add to collection
          </button>
        )}
        
        {/* Social proof */}
        {saveCount !== undefined && saveCount > 0 && (
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <p className="text-xs text-slate-500 font-medium">
              {saveCount} {saveCount === 1 ? 'buyer' : 'buyers'} saved
            </p>
          </div>
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
