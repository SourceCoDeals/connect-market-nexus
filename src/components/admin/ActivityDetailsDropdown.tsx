import { ChevronDown, Clock, ExternalLink, MousePointer, TrendingUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ActivityDetailsDropdownProps {
  session_id?: string;
  referrer?: string;
  time_on_page?: number;
  scroll_depth?: number;
  page_title?: string;
  event_category?: string;
  event_label?: string;
}

export function ActivityDetailsDropdown({
  session_id,
  referrer,
  time_on_page,
  scroll_depth,
  page_title,
  event_category,
  event_label
}: ActivityDetailsDropdownProps) {
  const hasDetails = session_id || referrer || time_on_page !== undefined || scroll_depth !== undefined;
  
  if (!hasDetails) return null;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  const formatReferrer = (ref?: string) => {
    if (!ref || ref === 'direct') return 'Direct';
    try {
      const url = new URL(ref);
      return url.hostname.replace('www.', '');
    } catch {
      return ref;
    }
  };

  const getReferrerSource = (ref?: string) => {
    if (!ref || ref === 'direct') return 'Direct';
    const hostname = formatReferrer(ref).toLowerCase();
    if (hostname.includes('google')) return 'Google';
    if (hostname.includes('facebook') || hostname.includes('fb.')) return 'Facebook';
    if (hostname.includes('linkedin')) return 'LinkedIn';
    if (hostname.includes('twitter') || hostname.includes('t.co')) return 'Twitter';
    return 'Referral';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-2 text-xs hover:bg-muted/50"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover border-border/50 shadow-lg z-50">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold text-foreground mb-2">Session details</p>
        </div>
        <DropdownMenuSeparator className="bg-border/50" />
        
        {session_id && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Session ID</span>
              <code className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded font-mono">
                {session_id.slice(0, 8)}...
              </code>
            </div>
          </div>
        )}

        {referrer && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Source
              </span>
              <Badge variant="outline" className="h-5 px-2 text-[10px] font-medium">
                {getReferrerSource(referrer)}
              </Badge>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground/70 truncate">
              {formatReferrer(referrer)}
            </div>
          </div>
        )}

        {time_on_page !== undefined && time_on_page > 0 && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Duration
              </span>
              <span className="font-medium">{formatDuration(time_on_page)}</span>
            </div>
          </div>
        )}

        {scroll_depth !== undefined && scroll_depth > 0 && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <MousePointer className="h-3 w-3" />
                Scroll depth
              </span>
              <span className="font-medium">{Math.round(scroll_depth)}%</span>
            </div>
          </div>
        )}

        {page_title && (
          <div className="px-3 py-2">
            <div className="text-xs">
              <span className="text-muted-foreground block mb-1">Page title</span>
              <span className="font-medium text-[10px] line-clamp-2">{page_title}</span>
            </div>
          </div>
        )}

        {event_category && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Category</span>
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                {event_category}
              </Badge>
            </div>
          </div>
        )}

        {event_label && (
          <div className="px-3 py-2">
            <div className="text-xs">
              <span className="text-muted-foreground block mb-1">Label</span>
              <span className="font-medium text-[10px]">{event_label}</span>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
