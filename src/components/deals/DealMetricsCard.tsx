import { Building2, TrendingUp, Users, DollarSign } from "lucide-react";
import { cn, formatCompactCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DealMetricsCardProps {
  listing: {
    title: string;
    category?: string;
    location?: string;
    image_url?: string | null;
    revenue?: number;
    ebitda?: number;
    full_time_employees?: number;
    part_time_employees?: number;
  };
  status: string;
  className?: string;
}


export function DealMetricsCard({ listing, status, className }: DealMetricsCardProps) {
  const totalEmployees = (listing.full_time_employees || 0) + (listing.part_time_employees || 0);
  
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "approved":
        return { 
          label: "Approved", 
          className: "bg-emerald-50/50 text-emerald-700 border-emerald-200/50" 
        };
      case "rejected":
        return { 
          label: "Rejected", 
          className: "bg-red-50/50 text-red-700 border-red-200/50" 
        };
      case "pending":
      default:
        return { 
          label: "Under Review", 
          className: "bg-amber-50/50 text-amber-700 border-amber-200/50" 
        };
    }
  };

  const statusConfig = getStatusConfig(status);
  
  const metrics = [
    {
      label: "Revenue",
      value: listing.revenue ? formatCompactCurrency(listing.revenue) : "N/A",
      icon: TrendingUp,
    },
    {
      label: "EBITDA",
      value: listing.ebitda ? formatCompactCurrency(listing.ebitda) : "N/A",
      icon: DollarSign,
    },
    {
      label: "Employees",
      value: totalEmployees > 0 ? totalEmployees.toString() : "N/A",
      icon: Users,
    },
    {
      label: "Location",
      value: listing.location || "N/A",
      icon: Building2,
    },
  ];


  return (
    <div className={cn("bg-muted/20 border border-border/30 rounded-xl p-6", className)}>
      {/* Header with Title and Status */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">
            {listing.title}
          </h2>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground/70">
            {listing.category && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {listing.category}
              </span>
            )}
            {listing.location && listing.category && (
              <span className="text-muted-foreground/40">•</span>
            )}
            {listing.location && <span>{listing.location}</span>}
          </div>
        </div>
        
        {/* Status Badge */}
        <Badge 
          variant="outline" 
          className={cn("text-[11px] font-medium px-2.5 py-0.5 shrink-0", statusConfig.className)}
        >
          {statusConfig.label}
        </Badge>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/30">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 uppercase tracking-wide mb-1">
              <metric.icon className="w-3 h-3" />
              {metric.label}
            </div>
            <div className="text-base font-semibold text-foreground">
              {metric.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
