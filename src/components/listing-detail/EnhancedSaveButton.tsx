import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSavedStatus, useSaveListingMutation } from '@/hooks/marketplace/use-saved-listings';
import { useListingSaveCount } from '@/hooks/use-collections';
import { SaveToCollectionDialog } from './SaveToCollectionDialog';
import { Bookmark, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EnhancedSaveButtonProps {
  listingId: string;
  onSave?: () => void;
  onShare?: () => void;
}

export function EnhancedSaveButton({ listingId, onSave, onShare }: EnhancedSaveButtonProps) {
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
      <div className="space-y-3">
        {/* Elegant text links */}
        <div className="flex items-center gap-8">
          {/* Save link */}
          <button
            onClick={handleQuickSave}
            disabled={isPending}
            className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-slate-700 transition-colors group"
          >
            <Bookmark className={cn(
              "h-[15px] w-[15px] transition-all",
              isSaved ? "fill-slate-500 text-slate-500" : "text-slate-400"
            )} />
            <span className="group-hover:underline decoration-slate-300 underline-offset-2">
              {isSaved ? 'Saved' : 'Save'}
            </span>
          </button>
          
          {/* Share link */}
          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-slate-700 transition-colors group"
            >
              <Share2 className="h-[15px] w-[15px] text-slate-400" />
              <span className="group-hover:underline decoration-slate-300 underline-offset-2">Share</span>
            </button>
          )}
        </div>
        
        {/* Social proof */}
        {saveCount !== undefined && saveCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-normal pt-1">
            {saveCount} {saveCount === 1 ? 'person has' : 'people have'} saved this
          </div>
        )}
        
        {/* Save to collection as subtle secondary action */}
        {isSaved && (
          <button
            onClick={handleSaveToCollection}
            className="text-[11px] text-slate-400 hover:text-slate-600 underline decoration-slate-300 hover:decoration-slate-400 underline-offset-2 transition-colors font-normal w-full text-left"
          >
            Add to collection
          </button>
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
