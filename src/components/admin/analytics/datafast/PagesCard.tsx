import { useState } from "react";
import { AnalyticsCard, SortToggle } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface PagesCardProps {
  topPages: Array<{ path: string; visitors: number; avgTime: number; bounceRate: number }>;
  entryPages: Array<{ path: string; visitors: number; bounceRate: number }>;
  exitPages: Array<{ path: string; exits: number; exitRate: number }>;
}

function formatPath(path: string): string {
  if (!path || path === '/') return '/';
  // Truncate long paths
  if (path.length > 35) {
    return path.substring(0, 32) + '...';
  }
  return path;
}

function getPathName(path: string): string {
  if (path === '/' || path === '') return 'Homepage';
  
  const pathNames: Record<string, string> = {
    '/marketplace': 'Marketplace',
    '/welcome': 'Welcome',
    '/signup': 'Sign Up',
    '/login': 'Login',
    '/profile': 'Profile',
    '/settings': 'Settings',
    '/saved': 'Saved Listings',
    '/dashboard': 'Dashboard',
    '/admin': 'Admin',
  };
  
  // Check for exact matches first
  if (pathNames[path]) return pathNames[path];
  
  // Check for prefix matches
  for (const [key, name] of Object.entries(pathNames)) {
    if (path.startsWith(key + '/')) return name;
  }
  
  // Handle listing pages
  if (path.startsWith('/listing/')) return 'Listing Detail';
  
  return formatPath(path);
}

export function PagesCard({ topPages, entryPages, exitPages }: PagesCardProps) {
  const [sortBy, setSortBy] = useState<'visitors' | 'connections'>('visitors');
  
  const tabs = [
    { id: 'page', label: 'Page' },
    { id: 'entry', label: 'Entry page' },
    { id: 'exit', label: 'Exit page' },
  ];

  return (
    <AnalyticsCard
      tabs={tabs}
      defaultTab="page"
      rightAction={<SortToggle value={sortBy} onChange={setSortBy} />}
    >
      {(activeTab) => (
        <div className="space-y-1">
          {activeTab === 'page' && (
            <>
              {topPages.slice(0, 8).map((page, i) => (
                <AnalyticsTooltip
                  key={`${page.path}-${i}`}
                  title={page.path}
                  rows={[
                    { label: 'Visitors', value: page.visitors.toLocaleString() },
                    { label: 'Bounce Rate', value: `${page.bounceRate.toFixed(0)}%` },
                  ]}
                >
                  <div className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
                        {formatPath(page.path)}
                      </code>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {page.visitors.toLocaleString()}
                    </span>
                  </div>
                </AnalyticsTooltip>
              ))}
              {topPages.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No page data</div>
              )}
            </>
          )}
          
          {activeTab === 'entry' && (
            <>
              {entryPages.slice(0, 8).map((page, i) => (
                <AnalyticsTooltip
                  key={`${page.path}-${i}`}
                  title={page.path}
                  rows={[
                    { label: 'Entries', value: page.visitors.toLocaleString() },
                    { label: 'Bounce Rate', value: `${page.bounceRate.toFixed(0)}%` },
                  ]}
                >
                  <div className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors">
                    <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
                      {formatPath(page.path)}
                    </code>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {page.bounceRate.toFixed(0)}% bounce
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {page.visitors.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </AnalyticsTooltip>
              ))}
              {entryPages.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No entry page data</div>
              )}
            </>
          )}
          
          {activeTab === 'exit' && (
            <>
              {exitPages.slice(0, 8).map((page, i) => (
                <AnalyticsTooltip
                  key={`${page.path}-${i}`}
                  title={page.path}
                  rows={[
                    { label: 'Exits', value: page.exits.toLocaleString() },
                    { label: 'Exit Rate', value: `${page.exitRate.toFixed(1)}%` },
                  ]}
                >
                  <div className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors">
                    <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
                      {formatPath(page.path)}
                    </code>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {page.exitRate.toFixed(0)}%
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {page.exits.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </AnalyticsTooltip>
              ))}
              {exitPages.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No exit page data</div>
              )}
            </>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}
