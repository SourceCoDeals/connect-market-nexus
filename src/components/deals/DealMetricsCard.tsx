import { Building2, TrendingUp, Users, DollarSign, MapPin } from "lucide-react";
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
          className: "bg-emerald-50 text-emerald-700 border-emerald-100" 
        };
      case "rejected":
        return { 
          label: "Rejected", 
          className: "bg-red-50 text-red-700 border-red-100" 
        };
      case "pending":
      default:
        return { 
          label: "Under Review", 
          className: "bg-amber-50 text-amber-700 border-amber-100" 
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
      icon: MapPin,
    },
  ];

  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg p-6", className)}>
      <div className="flex items-start gap-5">
        {/* Image Thumbnail */}
        {listing.image_url && (
          <div className="shrink-0">
            <img
              src={listing.image_url}
              alt={listing.title}
              loading="lazy"
              className="w-24 h-24 object-cover rounded border border-gray-200 bg-gray-50"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header with Title and Status */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 mb-1.5 tracking-tight">
                {listing.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {listing.category && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{listing.category}</span>
                  </div>
                )}
                {listing.location && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>{listing.location}</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Status Badge */}
            <Badge 
              variant="outline" 
              className={cn(
                "inline-flex items-center gap-1.5 h-6 px-2.5 py-0 text-xs font-medium rounded-full shrink-0",
                statusConfig.className
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
              {statusConfig.label}
            </Badge>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-gray-200">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
                  <metric.icon className="w-3.5 h-3.5" />
                  {metric.label}
                </div>
                <div className="text-lg font-semibold text-gray-900 tabular-nums">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
