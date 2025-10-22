import { DealMessageEditor } from './DealMessageEditor';
import { BuyerProfileStatus } from './BuyerProfileStatus';

interface DealReviewPanelProps {
  requestId: string;
  userMessage: string | null;
  onMessageUpdate: (message: string) => Promise<void>;
  isProfileComplete?: boolean;
  profileCompletionPercentage?: number;
}

export function DealReviewPanel({
  requestId,
  userMessage,
  onMessageUpdate,
  isProfileComplete = false,
  profileCompletionPercentage = 0,
}: DealReviewPanelProps) {
  return (
    <div className="mt-4 bg-slate-50/50 rounded-lg p-6 space-y-6 animate-in fade-in-0 slide-in-from-top-2 duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Message Editor */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Your Message
          </h3>
          <DealMessageEditor
            requestId={requestId}
            initialMessage={userMessage || ''}
            onMessageUpdate={onMessageUpdate}
          />
        </div>

        {/* Right: Profile Status */}
        <div>
          <BuyerProfileStatus
            isComplete={isProfileComplete}
            completionPercentage={profileCompletionPercentage}
          />
        </div>
      </div>

      {/* Subtle helper text */}
      <p className="text-xs text-slate-500 leading-relaxed">
        We're reviewing your request against the owner's requirements. Your message and buyer profile help us understand your fit for this opportunity.
      </p>
    </div>
  );
}
