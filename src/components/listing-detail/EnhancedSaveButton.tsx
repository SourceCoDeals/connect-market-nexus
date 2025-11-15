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
      <div className="space-y-2">
        {/* Elegant text links */}
        <div className="flex items-center gap-6 pt-5">
          {/* Save link */}
          <button
            onClick={handleQuickSave}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors group"
          >
            <Bookmark className={cn(
              "h-4 w-4 transition-colors",
              isSaved ? "fill-slate-600 text-slate-600" : "text-slate-600"
            )} />
            <span className="group-hover:underline decoration-slate-300">
              {isSaved ? 'Saved' : 'Save'}
            </span>
          </button>
          
          {/* Share link */}
          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors group"
            >
              <Share2 className="h-4 w-4" />
              <span className="group-hover:underline decoration-slate-300">Share</span>
            </button>
          )}
        </div>
        
        {/* Save to collection as subtle secondary action */}
        {isSaved && (
          <button
            onClick={handleSaveToCollection}
            className="text-xs text-slate-500 hover:text-slate-700 underline decoration-slate-300 hover:decoration-slate-500 underline-offset-2 transition-colors font-normal w-full text-left"
          >
            Add to collection
          </button>
        )}
        
        {/* Social proof */}
        {saveCount !== undefined && saveCount > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium tracking-wide uppercase pt-1">
            <span className="inline-block w-1 h-1 rounded-full bg-slate-400"></span>
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
