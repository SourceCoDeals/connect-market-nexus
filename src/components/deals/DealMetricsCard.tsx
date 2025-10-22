import { Building2, TrendingUp, Users, DollarSign } from "lucide-react";
import { cn, formatCompactCurrency } from "@/lib/utils";

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
  className?: string;
}

export function DealMetricsCard({ listing, className }: DealMetricsCardProps) {
  const totalEmployees = (listing.full_time_employees || 0) + (listing.part_time_employees || 0);
  
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
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Image */}
        {listing.image_url && (
          <div className="shrink-0">
            <img
              src={listing.image_url}
              alt={listing.title}
              className="w-full sm:w-32 h-32 object-cover rounded-lg border border-border/30"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground tracking-tight">
              {listing.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground/70">
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

          {listing.revenue && (
            <div>
              <div className="text-xs text-muted-foreground/60 uppercase tracking-wide">
                Annual Revenue
              </div>
              <div className="text-2xl font-semibold text-foreground mt-0.5">
                {formatCompactCurrency(listing.revenue)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/30">
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
