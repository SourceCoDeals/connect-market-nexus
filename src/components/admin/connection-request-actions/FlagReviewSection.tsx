/**
 * FlagReviewSection.tsx
 *
 * Flagged-for-review indicator banner, plus the "Flag for Review" popover
 * button used in both the pending decision banner and for non-pending statuses.
 */
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Flag, XCircle } from 'lucide-react';
import { User as UserType } from '@/types';
import type { AdminProfile } from './types';

interface FlagReviewBannerProps {
  requestId?: string;
  flaggedForReview?: boolean;
  flaggedByAdmin?: UserType | null;
  flaggedAssignedToAdmin?: UserType | null;
  handleUnflag: () => void;
  isFlagPending: boolean;
}

/**
 * The orange "Flagged for Review" indicator banner shown when a request
 * is flagged, regardless of status.
 */
export function FlagReviewBanner({
  requestId,
  flaggedForReview,
  flaggedByAdmin,
  flaggedAssignedToAdmin,
  handleUnflag,
  isFlagPending,
}: FlagReviewBannerProps) {
  if (!flaggedForReview || !requestId) return null;

  return (
    <div className="rounded-xl bg-orange-50 border border-orange-200 px-5 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center">
          <Flag className="h-4 w-4 text-white fill-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-orange-800">
            Flagged for Review
            {flaggedAssignedToAdmin && (
              <span className="font-normal text-orange-700">
                {' '}
                — assigned to {flaggedAssignedToAdmin.first_name}{' '}
                {flaggedAssignedToAdmin.last_name}
              </span>
            )}
          </p>
          {flaggedByAdmin && (
            <p className="text-xs text-orange-600">
              Flagged by {flaggedByAdmin.first_name} {flaggedByAdmin.last_name}
            </p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleUnflag}
        disabled={isFlagPending}
        className="text-xs h-7 text-orange-700 hover:text-orange-800 hover:bg-orange-200/50"
      >
        <XCircle className="h-3 w-3 mr-1" /> Remove Flag
      </Button>
    </div>
  );
}

interface FlagReviewPopoverProps {
  adminList: AdminProfile[];
  flagPopoverOpen: boolean;
  setFlagPopoverOpen: (open: boolean) => void;
  handleFlagForReview: (adminId: string) => void;
  align?: 'start' | 'end';
}

/**
 * The "Flag for Review" popover button that lists admins to assign.
 * Used both inline in the pending decision banner and standalone for
 * non-pending statuses.
 */
export function FlagReviewPopover({
  adminList,
  flagPopoverOpen,
  setFlagPopoverOpen,
  handleFlagForReview,
  align = 'end',
}: FlagReviewPopoverProps) {
  return (
    <Popover open={flagPopoverOpen} onOpenChange={setFlagPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 h-10 px-5 text-sm font-bold"
        >
          <Flag className="h-4 w-4 mr-1.5" />
          Flag for Review
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align={align}>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">
          Assign to team member
        </p>
        <div className="max-h-56 overflow-y-auto">
          {adminList.map((admin) => (
            <button
              key={admin.id}
              onClick={() => handleFlagForReview(admin.id)}
              className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors font-medium"
            >
              {admin.displayName}
            </button>
          ))}
          {adminList.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">No team members found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
