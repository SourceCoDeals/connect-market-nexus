import { FileText, Search, Home, User, LayoutDashboard, BookmarkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrentPagesPanelProps {
  data: Array<{
    pagePath: string;
    viewCount: number;
    uniqueSessions: number;
  }>;
}

const pageIcons: Record<string, React.ReactNode> = {
  'Home': <Home className="h-3.5 w-3.5" />,
  'Marketplace': <Search className="h-3.5 w-3.5" />,
  'Listing Detail': <FileText className="h-3.5 w-3.5" />,
  'Search': <Search className="h-3.5 w-3.5" />,
  'Profile': <User className="h-3.5 w-3.5" />,
  'Dashboard': <LayoutDashboard className="h-3.5 w-3.5" />,
  'Saved Listings': <BookmarkIcon className="h-3.5 w-3.5" />,
};

export function CurrentPagesPanel({ data }: CurrentPagesPanelProps) {
  const maxViews = Math.max(...data.map(d => d.viewCount), 1);

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6 h-full">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Current Pages
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Most viewed in last 5 minutes
        </p>
      </div>

      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No active page views
          </p>
        ) : (
          data.map((page, index) => (
            <div key={page.pagePath} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground">
                    {pageIcons[page.pagePath] || <FileText className="h-3.5 w-3.5" />}
                  </div>
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {page.pagePath}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold tabular-nums">{page.viewCount}</span>
                  <span className="text-xs text-muted-foreground ml-1">views</span>
                </div>
              </div>
              
              <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    index === 0 ? "bg-coral-500" : "bg-coral-400/60"
                  )}
                  style={{ width: `${(page.viewCount / maxViews) * 100}%` }}
                />
              </div>
              
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {page.uniqueSessions} unique session{page.uniqueSessions !== 1 ? 's' : ''}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
