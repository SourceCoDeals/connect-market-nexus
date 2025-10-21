import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SessionEvent, SessionMetadata } from "@/hooks/use-session-events";
import { ExternalLink } from "lucide-react";

interface EventPropertiesSheetProps {
  event: SessionEvent | null;
  sessionMetadata: SessionMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EventPropertiesSheet({
  event,
  sessionMetadata,
  open,
  onOpenChange,
}: EventPropertiesSheetProps) {
  if (!event) return null;

  const getEventType = () => {
    if (event.source === 'page_view') return 'Pageview';
    if (event.source === 'user_event') return 'User Event';
    if (event.source === 'listing_analytics') return 'Listing Analytics';
    return event.type;
  };

  const getDomain = () => {
    return window.location.hostname;
  };

  const getPath = () => {
    return event.metadata?.page_path || '/';
  };

  const getAppType = () => {
    return sessionMetadata?.device_type || 'Unknown';
  };

  const getMarketingChannel = () => {
    return sessionMetadata?.marketing_channel || 'Direct';
  };

  const getReferrer = () => {
    return sessionMetadata?.referrer || sessionMetadata?.full_referrer || 'Direct / None';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] z-[100]">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            Event Properties
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detailed properties and metadata for the selected event
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Type */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Type</h4>
            <p className="text-sm">{getEventType()}</p>
          </div>

          {/* Domain */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Domain</h4>
            <a 
              href={`https://${getDomain()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              https://{getDomain()}
            </a>
          </div>

          {/* Path */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Path</h4>
            <p className="text-sm font-mono">{getPath()}</p>
          </div>

          {/* App Type */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">App Type</h4>
            <p className="text-sm">{getAppType()}</p>
          </div>

          {/* Marketing Channel */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Marketing Channel</h4>
            <p className="text-sm">{getMarketingChannel()}</p>
          </div>

          {/* Session Referrer */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Session Source (Referrer)</h4>
            <p className="text-sm break-all">{getReferrer()}</p>
          </div>

          {/* UTM Parameters if available */}
          {(sessionMetadata?.utm_source || sessionMetadata?.utm_medium || sessionMetadata?.utm_campaign) && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">UTM Parameters</h4>
              <div className="space-y-2">
                {sessionMetadata.utm_source && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Source:</span> {sessionMetadata.utm_source}
                  </div>
                )}
                {sessionMetadata.utm_medium && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Medium:</span> {sessionMetadata.utm_medium}
                  </div>
                )}
                {sessionMetadata.utm_campaign && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Campaign:</span> {sessionMetadata.utm_campaign}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event ID */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Event ID</h4>
            <p className="text-sm font-mono text-muted-foreground">{event.id}</p>
          </div>

          {/* Browser */}
          {sessionMetadata?.browser && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Browser</h4>
              <p className="text-sm">{sessionMetadata.browser}</p>
            </div>
          )}

          {/* Element Details if available */}
          {event.metadata?.element_id && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Element ID</h4>
              <p className="text-sm font-mono">{event.metadata.element_id}</p>
            </div>
          )}

          {event.metadata?.element_class && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Element Class</h4>
              <p className="text-sm font-mono">{event.metadata.element_class}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
