import { formatDistanceToNow } from "date-fns";
import { Calendar } from "lucide-react";

interface DealDetailsCardProps {
  listing: {
    category?: string;
    location?: string;
    description?: string;
  };
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


export function DealDetailsCard({ listing, createdAt }: DealDetailsCardProps) {
  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Calendar className="w-4 h-4" />
        <span>Submitted {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
      </div>

      {/* Description Preview */}
      {listing.description && (
        <div className="space-y-2.5 border-t border-gray-200 pt-5">
          <h3 className="text-sm font-semibold text-gray-900">
            About this opportunity
          </h3>
          <p className="text-sm text-gray-600 leading-6 whitespace-pre-line">
            {getDescriptionPreview(listing.description)}
          </p>
        </div>
      )}
    </div>
  );
}
