import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Calendar } from "lucide-react";

interface DealDetailsCardProps {
  listing: {
    category?: string;
    location?: string;
    description?: string;
  };
  userMessage?: string;
  createdAt: string;
}

// Helper to get description preview with natural break point
const getDescriptionPreview = (description: string, maxLength: number = 200): string => {
  if (description.length <= maxLength) return description;
  
  // Find last period or newline before maxLength
  const truncated = description.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  
  const breakPoint = Math.max(lastPeriod, lastNewline);
  
  // If we found a good break point in the last 30% of the truncated text
  if (breakPoint > 0 && breakPoint > maxLength * 0.7) {
    return truncated.slice(0, breakPoint + 1);
  }
  
  // Otherwise, just truncate at maxLength
  return truncated.trim() + '...';
};


export function DealDetailsCard({ listing, userMessage, createdAt }: DealDetailsCardProps) {
  return (
    <div className="space-y-5">
      {/* Timeline */}
      <div className="flex items-center gap-2 text-sm text-gray-500 transition-colors duration-200 hover:text-gray-700">
        <Calendar className="w-3.5 h-3.5" />
        <span>Submitted {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
      </div>

      {/* Description Preview */}
      {listing.description && (
        <div className="space-y-3 border-t border-gray-200 pt-5">
          <h3 className="text-base font-semibold text-foreground tracking-tight">
            About this opportunity
          </h3>
          <p className="text-sm text-gray-700 leading-6 whitespace-pre-line">
            {getDescriptionPreview(listing.description)}
          </p>
        </div>
      )}

      {/* User Message */}
      {userMessage && (
        <div className="space-y-3 border-t border-gray-200 pt-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-gray-600" aria-hidden="true" />
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Your message
            </h3>
          </div>
          <div className="bg-gray-50/50 rounded-lg p-4 border border-gray-200 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50">
            <p className="text-sm text-gray-700 leading-6 whitespace-pre-wrap">
              {userMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
