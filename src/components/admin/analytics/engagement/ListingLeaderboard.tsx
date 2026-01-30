import { useState } from "react";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/exportUtils";

interface ListingData {
  id: string;
  title: string;
  category: string;
  views: number;
  saves: number;
  requests: number;
  conversionRate: number;
}

interface ListingLeaderboardProps {
  data: ListingData[];
  className?: string;
}

type SortField = 'views' | 'saves' | 'requests' | 'conversionRate';

export function ListingLeaderboard({ data, className }: ListingLeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>('views');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedData = [...data].sort((a, b) => {
    const multiplier = sortAsc ? 1 : -1;
    return (a[sortField] - b[sortField]) * multiplier;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExport = () => {
    exportToCSV(sortedData, 'listing-leaderboard', [
      { key: 'title', label: 'Listing' },
      { key: 'category', label: 'Category' },
      { key: 'views', label: 'Views' },
      { key: 'saves', label: 'Saves' },
      { key: 'requests', label: 'Requests' },
      { key: 'conversionRate', label: 'Conversion Rate %' },
    ]);
  };

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Listing Leaderboard
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Top performing listings by engagement
          </p>
        </div>
        {data.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  #
                </span>
              </th>
              <th className="text-left py-3 px-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Listing
                </span>
              </th>
              <th className="text-left py-3 px-2 hidden md:table-cell">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Category
                </span>
              </th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('views')}
              >
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  sortField === 'views' ? 'text-coral-500' : 'text-muted-foreground'
                )}>
                  Views {sortField === 'views' && (sortAsc ? '↑' : '↓')}
                </span>
              </th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('saves')}
              >
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  sortField === 'saves' ? 'text-coral-500' : 'text-muted-foreground'
                )}>
                  Saves {sortField === 'saves' && (sortAsc ? '↑' : '↓')}
                </span>
              </th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('requests')}
              >
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  sortField === 'requests' ? 'text-coral-500' : 'text-muted-foreground'
                )}>
                  Requests {sortField === 'requests' && (sortAsc ? '↑' : '↓')}
                </span>
              </th>
              <th 
                className="text-right py-3 px-2 cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                onClick={() => handleSort('conversionRate')}
              >
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  sortField === 'conversionRate' ? 'text-coral-500' : 'text-muted-foreground'
                )}>
                  Conv % {sortField === 'conversionRate' && (sortAsc ? '↑' : '↓')}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.slice(0, 15).map((listing, index) => (
              <tr 
                key={listing.id}
                className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="py-3 px-2">
                  <span className="text-xs text-muted-foreground/60 tabular-nums">
                    {index + 1}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                    {listing.title}
                  </p>
                </td>
                <td className="py-3 px-2 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {listing.category}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  <span className="text-sm font-medium tabular-nums">
                    {listing.views.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  <span className="text-sm font-medium tabular-nums">
                    {listing.saves}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  <span className="text-sm font-medium tabular-nums text-coral-500">
                    {listing.requests}
                  </span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {listing.conversionRate.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No listing data available
          </p>
        )}
      </div>
    </div>
  );
}
