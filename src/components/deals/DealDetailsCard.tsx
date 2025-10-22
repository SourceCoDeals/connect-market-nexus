import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Calendar, Building2, MapPin } from "lucide-react";
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
          className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" 
        };
      case "rejected":
        return { 
          label: "Rejected", 
          className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800" 
        };
      case "pending":
      default:
        return { 
          label: "Under Review", 
          className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" 
        };
    }
  };

  const statusConfig = getStatusConfig(status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2 flex-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {listing.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground/70">
            {listing.category && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>{listing.category}</span>
              </div>
            )}
            {listing.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{listing.location}</span>
              </div>
            )}
          </div>
        </div>
        <Badge 
          variant="outline" 
          className={cn("text-[11px] font-medium px-2.5 py-0.5 shrink-0", statusConfig.className)}
        >
          {statusConfig.label}
        </Badge>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground/60 border-t border-border/50 pt-4">
        <Calendar className="w-3.5 h-3.5" />
        <span>Submitted {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
      </div>

      {/* Description */}
      {listing.description && (
        <div className="space-y-2 border-t border-border/50 pt-5">
          <h3 className="text-[13px] font-semibold text-foreground/90 tracking-tight">
            About this opportunity
          </h3>
          <p className="text-sm text-muted-foreground/70 leading-relaxed">
            {listing.description}
          </p>
        </div>
      )}

      {/* User Message */}
      {userMessage && (
        <div className="space-y-2.5 border-t border-border/50 pt-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60" />
            <h3 className="text-[13px] font-semibold text-foreground/90 tracking-tight">
              Your message
            </h3>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {userMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
