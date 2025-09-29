import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Eye, 
  EyeOff, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Activity,
  Target
} from "lucide-react";
import { AdminListing } from "@/types/admin";
import { formatCurrency } from "@/lib/utils";


interface AdminListingsStatsProps {
  listings: AdminListing[];
}

export function AdminListingsStats({ listings }: AdminListingsStatsProps) {
  const activeListings = listings.filter(l => l.status === 'active');
  const inactiveListings = listings.filter(l => l.status === 'inactive');
  
  const totalRevenue = listings.reduce((sum, listing) => sum + (Number(listing.revenue) || 0), 0);
  const totalEbitda = listings.reduce((sum, listing) => sum + (Number(listing.ebitda) || 0), 0);
  const avgRevenue = listings.length > 0 ? totalRevenue / listings.length : 0;
  const avgEbitda = listings.length > 0 ? totalEbitda / listings.length : 0;

  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentListings = listings.filter(l => new Date(l.created_at) >= lastWeek);

  const stats = [
    {
      label: "Total Listings",
      value: listings.length.toString(),
      icon: Building2,
      color: "text-sourceco",
      bgColor: "bg-sourceco/10",
      description: `${activeListings.length} active, ${inactiveListings.length} inactive`
    },
    {
      label: "Active Listings",
      value: activeListings.length.toString(),
      icon: Eye,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
      description: `${((activeListings.length / listings.length) * 100 || 0).toFixed(1)}% of total`
    },
    {
      label: "Total Portfolio Value",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      description: "Combined revenue"
    },
    {
      label: "Average Revenue",
      value: formatCurrency(avgRevenue),
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      description: "Per listing"
    },
    {
      label: "Average EBITDA",
      value: formatCurrency(avgEbitda),
      icon: Target,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      description: "Per listing"
    },
    {
      label: "Added This Week",
      value: recentListings.length.toString(),
      icon: Calendar,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
      description: "Last 7 days"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <Badge variant="outline" className="text-xs bg-background/80">
                  {stat.label}
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-semibold text-foreground">
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stat.description}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}