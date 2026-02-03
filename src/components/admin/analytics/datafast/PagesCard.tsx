import { useState } from "react";
import { Globe } from "lucide-react";
import { AnalyticsCard } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { cn } from "@/lib/utils";
import { ProportionalBar } from "./ProportionalBar";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFiltersContext";
import { FilterModal } from "./FilterModal";

interface PagesCardProps {
  topPages: Array<{ path: string; visitors: number; avgTime: number; bounceRate: number }>;
  entryPages: Array<{ path: string; visitors: number; bounceRate: number }>;
  exitPages: Array<{ path: string; exits: number; exitRate: number }>;
  blogEntryPages: Array<{ path: string; visitors: number; sessions: number }>;
}

function formatPath(path: string): string {
  if (!path || path === '/') return '/';
  if (path.length > 35) {
    return path.substring(0, 32) + '...';
  }
  return path;
}

export function PagesCard({ topPages, entryPages, exitPages, blogEntryPages }: PagesCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<string>('');
  const { hasFilter } = useAnalyticsFilters();
  
  const tabs = [
    { id: 'page', label: 'Page' },
    { id: 'entry', label: 'Entry page' },
    { id: 'blog', label: 'Blog Entry' },
    { id: 'exit', label: 'Exit page' },
  ];

  const maxPageVisitors = Math.max(...topPages.map(p => p.visitors), 1);
  const maxEntryVisitors = Math.max(...entryPages.map(p => p.visitors), 1);
  const maxBlogVisitors = Math.max(...blogEntryPages.map(p => p.visitors), 1);
  const maxExitVisitors = Math.max(...exitPages.map(p => p.exits), 1);

  // Removed - filtering now only via Details modal

  const handleDetailsClick = (activeTab: string) => {
    setModalTab(activeTab);
    setModalOpen(true);
  };

  const getModalItems = () => {
    switch (modalTab) {
      case 'page':
        return topPages.map(p => ({
          id: p.path,
          label: p.path,
          visitors: p.visitors,
        }));
      case 'entry':
        return entryPages.map(p => ({
          id: p.path,
          label: p.path,
          visitors: p.visitors,
        }));
      case 'blog':
        return blogEntryPages.map(p => ({
          id: p.path,
          label: p.path,
          visitors: p.visitors,
        }));
      case 'exit':
        return exitPages.map(p => ({
          id: p.path,
          label: p.path,
          visitors: p.exits,
        }));
      default:
        return [];
    }
  };

  const getModalTitle = () => {
    switch (modalTab) {
      case 'page': return 'Pages';
      case 'entry': return 'Entry Pages';
      case 'blog': return 'Blog Entry Pages';
      case 'exit': return 'Exit Pages';
      default: return 'Details';
    }
  };

  return (
    <>
      <AnalyticsCard
        tabs={tabs}
        defaultTab="page"
        onDetailsClick={handleDetailsClick}
      >
        {(activeTab) => (
          <div className="space-y-1">
            {activeTab === 'page' && (
              <>
                {topPages.slice(0, 8).map((page, i) => {
                  const isActive = hasFilter('page', page.path);
                  return (
                    <AnalyticsTooltip
                      key={`${page.path}-${i}`}
                      title={page.path}
                      rows={[
                        { label: 'Visitors', value: page.visitors.toLocaleString() },
                        { label: 'Bounce Rate', value: `${page.bounceRate.toFixed(0)}%` },
                      ]}
                    >
                      <ProportionalBar value={page.visitors} maxValue={maxPageVisitors}>
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
                              {formatPath(page.path)}
                            </code>
                          </div>
                          <span className="text-sm font-medium tabular-nums">
                            {page.visitors.toLocaleString()}
                          </span>
                        </div>
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {topPages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No page data</div>
                )}
              </>
            )}
            
            {activeTab === 'entry' && (
              <>
                {entryPages.slice(0, 8).map((page, i) => {
                  const isActive = hasFilter('page', page.path);
                  return (
                    <AnalyticsTooltip
                      key={`${page.path}-${i}`}
                      title={page.path}
                      rows={[
                        { label: 'Entries', value: page.visitors.toLocaleString() },
                        { label: 'Bounce Rate', value: `${page.bounceRate.toFixed(0)}%` },
                      ]}
                    >
                      <ProportionalBar value={page.visitors} maxValue={maxEntryVisitors}>
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
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
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {entryPages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No entry page data</div>
                )}
              </>
            )}
            
            {activeTab === 'blog' && (
              <>
                {blogEntryPages.slice(0, 8).map((page, i) => {
                  const isActive = hasFilter('page', page.path);
                  return (
                    <AnalyticsTooltip
                      key={`${page.path}-${i}`}
                      title={page.path}
                      rows={[
                        { label: 'Visitors', value: page.visitors.toLocaleString() },
                        { label: 'Sessions', value: page.sessions.toLocaleString() },
                      ]}
                    >
                      <ProportionalBar value={page.visitors} maxValue={maxBlogVisitors}>
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono truncate max-w-[180px]">
                              {formatPath(page.path)}
                            </code>
                          </div>
                          <span className="text-sm font-medium tabular-nums">
                            {page.visitors.toLocaleString()}
                          </span>
                        </div>
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {blogEntryPages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No blog entry data</div>
                )}
              </>
            )}
            
            {activeTab === 'exit' && (
              <>
                {exitPages.slice(0, 8).map((page, i) => {
                  const isActive = hasFilter('page', page.path);
                  return (
                    <AnalyticsTooltip
                      key={`${page.path}-${i}`}
                      title={page.path}
                      rows={[
                        { label: 'Exits', value: page.exits.toLocaleString() },
                        { label: 'Exit Rate', value: `${page.exitRate.toFixed(1)}%` },
                      ]}
                    >
                      <ProportionalBar value={page.exits} maxValue={maxExitVisitors}>
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
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
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {exitPages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No exit page data</div>
                )}
              </>
            )}
          </div>
        )}
      </AnalyticsCard>

      <FilterModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={getModalTitle()}
        filterType="page"
        items={getModalItems()}
        sortBy="visitors"
      />
    </>
  );
}
