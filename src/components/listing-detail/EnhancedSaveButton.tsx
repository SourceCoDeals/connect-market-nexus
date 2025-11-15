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
    <TooltipProvider>
      <div className="space-y-2">
        {/* Horizontal layout: Save (75%) + Share (25%) */}
        <div className="flex gap-1.5">
          {/* Save button - Primary action, 75% width */}
          <Button
            variant="outline"
            onClick={handleQuickSave}
            disabled={isPending}
            className="flex-[3] h-9 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium text-[13px] tracking-[0.002em] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sourceco-accent/30 focus:ring-offset-2"
          >
            <Bookmark className={cn(
              "h-3.5 w-3.5 transition-colors",
              isSaved ? "fill-slate-700 text-slate-700" : "text-slate-400"
            )} />
            {isSaved ? 'Saved' : 'Save'}
          </Button>
          
          {/* Share button - Secondary action, 25% width, icon-only */}
          {onShare && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={onShare}
                  className="flex-1 h-9 px-0 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sourceco-accent/30 focus:ring-offset-2"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Share with colleague</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
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
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-medium tracking-[0.05em] uppercase pt-1">
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
    </TooltipProvider>
  );
}
