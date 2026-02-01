import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Home, Search, ShoppingBag, User, BookOpen } from "lucide-react";

interface TopLandingPagesProps {
  pages: { page: string; count: number }[];
  isLoading: boolean;
}

const pageIcons: Record<string, React.ReactNode> = {
  '/': <Home className="h-3.5 w-3.5" />,
  '/welcome': <Home className="h-3.5 w-3.5" />,
  '/explore': <Search className="h-3.5 w-3.5" />,
  '/listings': <ShoppingBag className="h-3.5 w-3.5" />,
  '/signup': <User className="h-3.5 w-3.5" />,
  '/login': <User className="h-3.5 w-3.5" />,
  '/blog': <BookOpen className="h-3.5 w-3.5" />,
};

export function TopLandingPages({ pages, isLoading }: TopLandingPagesProps) {
  const totalCount = pages.reduce((sum, p) => sum + p.count, 0);

  const getIcon = (page: string) => {
    if (pageIcons[page]) return pageIcons[page];
    if (page.startsWith('/listing/')) return <ShoppingBag className="h-3.5 w-3.5" />;
    if (page.startsWith('/blog')) return <BookOpen className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  };

  const getPageLabel = (page: string): string => {
    if (page === '/') return 'Homepage';
    if (page === '/welcome') return 'Welcome Page';
    if (page === '/explore') return 'Explore Listings';
    if (page === '/signup') return 'Sign Up';
    if (page === '/login') return 'Login';
    if (page.startsWith('/listing/')) return `Listing: ${page.split('/').pop()?.slice(0, 8)}...`;
    return page;
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Top Landing Pages</CardTitle>
        <p className="text-xs text-muted-foreground">
          First pages visitors see when arriving
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No landing page data yet
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((item, index) => {
              const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
              
              return (
                <div 
                  key={item.page}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  {/* Rank */}
                  <span className="text-xs font-medium text-muted-foreground w-4">
                    {index + 1}
                  </span>
                  
                  {/* Icon */}
                  <div className="p-1.5 rounded-md bg-secondary/80 text-secondary-foreground">
                    {getIcon(item.page)}
                  </div>
                  
                  {/* Page name and bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate" title={item.page}>
                        {getPageLabel(item.page)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-secondary transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Count */}
                  <span className="text-sm font-semibold tabular-nums w-8 text-right">
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
