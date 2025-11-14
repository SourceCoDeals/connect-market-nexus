import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSavedStatus, useSaveListingMutation } from '@/hooks/marketplace/use-saved-listings';
import { useListingSaveCount } from '@/hooks/use-collections';
import { SaveToCollectionDialog } from './SaveToCollectionDialog';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

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
          onClick={handleQuickSave}
          disabled={isPending}
          className="w-full h-10 border-slate-300 hover:border-sourceco-accent bg-white hover:bg-sourceco-accent/5 text-slate-700 hover:text-slate-900 font-normal text-[13px] tracking-[0.01em] transition-all duration-200 group"
        >
          <Heart className={cn(
            "h-3.5 w-3.5 transition-colors",
            isSaved ? "fill-sourceco-accent text-sourceco-accent" : "text-slate-400 group-hover:text-sourceco-accent"
          )} />
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
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium tracking-wide uppercase pt-1">
            <span className="inline-block w-1 h-1 rounded-full bg-sourceco-accent"></span>
            {saveCount} {saveCount === 1 ? 'buyer' : 'buyers'} saved
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
