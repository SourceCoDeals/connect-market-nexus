import { Building2, TrendingUp, Users, DollarSign, MapPin, ExternalLink, Gem, Info } from "lucide-react";
import { cn, formatCompactCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DealMetricsCardProps {
  listing: {
    id?: string;
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
    <div className={cn("relative bg-white border border-gray-200 rounded-lg p-6", className)}>
      {/* Off-Market Badge - Stripe/Apple minimalist design */}
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <div className="absolute -top-2.5 left-6 z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-help">
                <Gem className="w-3 h-3 text-gray-700 fill-gray-100" strokeWidth={2} />
                <span className="text-[11px] font-medium text-gray-700 tracking-wide">
                  Off-Market
                </span>
                <Info className="w-3 h-3 text-gray-400" strokeWidth={2} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent 
            side="bottom" 
            align="start"
            className="max-w-sm p-4"
          >
            <p className="text-xs leading-relaxed">
              We share each deal confidentially with our curated network of buyers and take time to learn about every group's value add, how they approach structure, valuation, and the overall investment thesis, and how their approach fits into seller's expectations and timeline.
              <br /><br />
              We are not representing the seller in this process; we never serve as sell-side representation. There are also no other intermediaries involved in the process. All deals on the marketplace are directly with the owner (seller).
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex items-start gap-6">
        {/* Image Thumbnail */}
        {listing.image_url && (
          <div className="shrink-0">
            <img
              src={listing.image_url}
              alt={listing.title}
              loading="lazy"
              className="w-48 h-48 object-cover rounded-lg border border-gray-200 bg-gray-50"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header with Title and Status */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                  {listing.title}
                </h2>
                {listing.id && (
                  <Link
                    to={`/listing/${listing.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    View listing
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2">
                {listing.category && (
                  <span className="text-xs font-medium text-gray-600 tracking-wide">
                    {listing.category}
                  </span>
                )}
                {listing.category && listing.location && (
                  <span className="text-gray-300 text-xs">•</span>
                )}
                {listing.location && (
                  <span className="text-xs font-medium text-gray-600 tracking-wide">
                    {listing.location}
                  </span>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-5 border-t border-gray-100">
            {metrics.map((metric) => (
              <div key={metric.label} className="space-y-1">
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {metric.label}
                </div>
                <div className="text-base font-semibold text-gray-900 tabular-nums">
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
