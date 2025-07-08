
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, FileText } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface ListingDetailSidebarProps {
  revenue: number;
  ebitda: number;
  createdAt: string;
  listingId: string;
}

export const ListingDetailSidebar = ({ 
  revenue, 
  ebitda, 
  createdAt, 
  listingId 
}: ListingDetailSidebarProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getListingAge = (dateString: string) => {
    const days = differenceInDays(new Date(), new Date(dateString));
    if (days >= 30) {
      return "30+ days";
    }
    return days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Financial Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Annual Revenue:</span>
                <span className="font-semibold">{formatCurrency(revenue)}</span>
              </div>
              <div className="h-2 bg-muted rounded">
                <div className="h-full bg-primary rounded" style={{ width: '100%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Annual EBITDA:</span>
                <span className="font-semibold">{formatCurrency(ebitda)}</span>
              </div>
              <div className="h-2 bg-muted rounded">
                <div className="h-full bg-primary rounded" style={{ 
                  width: `${Math.min((ebitda / revenue) * 100, 100)}%` 
                }}></div>
              </div>
            </div>

            {revenue > 0 && (
              <div className="pt-2 border-t mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">EBITDA Margin:</span>
                  <span className="font-semibold">
                    {((ebitda / revenue) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Listing Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Listed:</span>
            </span>
            <span className="text-sm font-medium">{getListingAge(createdAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Listing ID:</span>
            </span>
            <span className="text-sm font-mono">{listingId.substring(0, 8)}...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
