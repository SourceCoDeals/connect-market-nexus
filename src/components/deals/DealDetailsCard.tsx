import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Calendar, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DealDetailsCardProps {
  listing: {
    title: string;
    category?: string;
    location?: string;
    description?: string;
  };
  userMessage?: string;
  status: string;
  createdAt: string;
}

export function DealDetailsCard({ listing, userMessage, status, createdAt }: DealDetailsCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "approved":
        return { 
          label: "Approved", 
          className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50" 
        };
      case "rejected":
        return { 
          label: "Rejected", 
          className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50" 
        };
      case "pending":
      default:
        return { 
          label: "Under Review", 
          className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50" 
        };
    }
  };

  const statusConfig = getStatusConfig(status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-foreground">{listing.title}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {listing.category && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                {listing.category}
              </div>
            )}
            {listing.location && (
              <span>• {listing.location}</span>
            )}
          </div>
        </div>
        <Badge className={cn("text-xs font-medium", statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span>Submitted {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
      </div>

      {/* Description */}
      {listing.description && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">About this opportunity</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {listing.description}
          </p>
        </div>
      )}

      {/* User Message */}
      {userMessage && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Your message</h3>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {userMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
