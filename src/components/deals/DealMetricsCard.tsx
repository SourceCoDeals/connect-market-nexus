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
          variant: "outline" as const,
          className: "bg-emerald-50 text-emerald-700 border-emerald-200" 
        };
      case "rejected":
        return { 
          label: "Rejected",
          variant: "outline" as const, 
          className: "bg-red-50 text-red-700 border-red-200" 
        };
      case "pending":
      default:
        return { 
          label: "Under Review",
          variant: "outline" as const, 
          className: "bg-amber-50 text-amber-700 border-amber-200" 
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
    <div className={cn(
      "bg-white border border-gray-200 rounded-xl p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5",
      className
    )}>
      <div className="flex gap-6 mb-6">
        {/* Image */}
        <div className="shrink-0">
          {listing.image_url ? (
            <img
              src={listing.image_url}
              alt={listing.title}
              loading="lazy"
              className="w-32 h-32 object-cover rounded-lg border border-gray-200 shadow-sm bg-gray-100 transition-all duration-200 hover:shadow-md"
            />
          ) : (
            <div className="w-32 h-32 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center shadow-sm">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Title and Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h2 className="text-xl font-semibold text-foreground truncate tracking-tight">
              {listing.title}
            </h2>
            <Badge 
              variant={statusConfig.variant}
              className="shrink-0 inline-flex items-center gap-1.5 h-5 px-2 py-0 text-[11px] font-medium rounded-md transition-all duration-200"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
              {statusConfig.label}
            </Badge>
          </div>
          
          {/* Category and Location */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {listing.category && (
              <>
                <span>{listing.category}</span>
                {listing.location && <span>•</span>}
              </>
            )}
            {listing.location && <span>{listing.location}</span>}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((metric) => (
          <div 
            key={metric.label} 
            className="group transition-all duration-200 hover:translate-y-[-1px] cursor-default"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 uppercase tracking-wide mb-1.5">
              <metric.icon className="w-3 h-3" />
              {metric.label}
            </div>
            <div className="text-2xl font-semibold text-foreground tabular-nums tracking-tight">
              {metric.value || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
