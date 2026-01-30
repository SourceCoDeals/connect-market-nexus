import { cn } from "@/lib/utils";

interface TopListing {
  id: string;
  title: string;
  connectionCount: number;
  category: string;
}

interface TopListingsCardProps {
  listings: TopListing[];
  className?: string;
}

export function TopListingsCard({ listings, className }: TopListingsCardProps) {
  const maxCount = Math.max(...listings.map(l => l.connectionCount), 1);

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Top Performing
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Most requested listings
        </p>
      </div>

      {/* Listings */}
      <div className="space-y-3">
        {listings.slice(0, 5).map((listing) => {
          const barWidth = (listing.connectionCount / maxCount) * 100;
          
          return (
            <div 
              key={listing.id}
              className="group cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-coral-500 transition-colors">
                    {listing.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {listing.category}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums text-foreground flex-shrink-0">
                  {listing.connectionCount}
                </span>
              </div>
              <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-coral-400 to-peach-400 rounded-full transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}

        {listings.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No listings yet
          </p>
        )}
      </div>
    </div>
  );
}
