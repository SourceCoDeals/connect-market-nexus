import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ExternalLink } from "lucide-react";
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

const ActivityDetailsDropdown = ({
  session_id,
  referrer,
  time_on_page,
  scroll_depth,
  page_title,
  event_category,
  event_label,
}: ActivityDetailsDropdownProps) => {
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatReferrer = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const getReferrerSource = (url: string) => {
    const hostname = formatReferrer(url);
    if (hostname.includes('google')) return 'Google';
    if (hostname.includes('facebook')) return 'Facebook';
    if (hostname.includes('linkedin')) return 'LinkedIn';
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'Twitter';
    if (hostname.includes('chatgpt')) return 'ChatGPT';
    return hostname;
  };

  const hasDetails = session_id || referrer || time_on_page || scroll_depth || page_title || event_category || event_label;

  if (!hasDetails) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
        Session details
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-96 p-0 bg-background border border-border shadow-xl z-[100]"
        sideOffset={5}
      >
        <div className="p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4">Session details</h4>
          
          <div className="space-y-4">
            {session_id && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Session ID</p>
                <p className="text-xs font-mono text-foreground bg-muted/50 px-2 py-1.5 rounded">
                  {session_id}
                </p>
              </div>
            )}
            
            {referrer && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Source</p>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {getReferrerSource(referrer)}
                  </Badge>
                </div>
                <a 
                  href={referrer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 break-all"
                >
                  {referrer}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>
            )}
            
            {time_on_page !== undefined && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-xs font-semibold text-foreground">{formatDuration(time_on_page)}</p>
              </div>
            )}
            
            {scroll_depth !== undefined && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Scroll depth</p>
                <p className="text-xs font-semibold text-foreground">{scroll_depth}%</p>
              </div>
            )}
            
            {page_title && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Page</p>
                <p className="text-sm font-semibold text-foreground">{page_title}</p>
              </div>
            )}
            
            {event_category && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Event category</p>
                <Badge variant="outline" className="text-xs">
                  {event_category}
                </Badge>
              </div>
            )}
            
            {event_label && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Event label</p>
                <p className="text-xs text-foreground">{event_label}</p>
              </div>
            )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { ActivityDetailsDropdown };
export default ActivityDetailsDropdown;
