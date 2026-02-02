import { cn } from '@/lib/utils';

interface JourneyPathProps {
  pages: string[];
  className?: string;
}

/**
 * Premium path visualization showing the exact sequence of pages visited.
 * Current page is highlighted with brand coral styling.
 */
export function JourneyPath({ pages, className }: JourneyPathProps) {
  if (!pages || pages.length === 0) {
    return (
      <span className="text-xs text-muted-foreground/60 italic">
        No page views recorded
      </span>
    );
  }

  // Show max 5 pages to avoid overflow, with ellipsis if truncated
  const displayPages = pages.length > 5 
    ? [...pages.slice(0, 2), '...', ...pages.slice(-2)]
    : pages;

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-hide", className)}>
      {displayPages.map((page, i) => (
        <div key={i} className="flex items-center gap-1 flex-shrink-0">
          {page === '...' ? (
            <span className="text-muted-foreground/40 text-xs px-1">•••</span>
          ) : (
            <div
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-mono transition-all",
                i === displayPages.length - 1
                  ? "bg-gradient-to-r from-coral-500/15 to-coral-400/10 text-coral-600 dark:text-coral-400 border border-coral-500/20 shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
              )}
            >
              {truncatePath(page)}
            </div>
          )}
          {i < displayPages.length - 1 && page !== '...' && displayPages[i + 1] !== '...' && (
            <span className="text-muted-foreground/30 text-[10px]">→</span>
          )}
        </div>
      ))}
      
      {/* Page count indicator */}
      <span className="text-[10px] text-muted-foreground/50 ml-1 flex-shrink-0">
        ({pages.length} {pages.length === 1 ? 'page' : 'pages'})
      </span>
    </div>
  );
}

/**
 * Truncate long paths for display
 */
function truncatePath(path: string): string {
  if (path.length <= 16) return path;
  
  // For paths like /marketplace/listing/abc123, show /marketplace/...
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 2) {
    return `/${parts[0]}/...`;
  }
  
  return path.slice(0, 14) + '...';
}
