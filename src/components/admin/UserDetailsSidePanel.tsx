import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUserDetails } from "@/hooks/use-user-details";
import { useUserSessions } from "@/hooks/use-user-sessions";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Calendar, Globe, Link as LinkIcon, Monitor, Smartphone, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import SessionEventsDialog from "./SessionEventsDialog";

interface UserDetailsSidePanelProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UserDetailsSidePanel = ({ userId, open, onOpenChange }: UserDetailsSidePanelProps) => {
  const { data: userDetails, isLoading: detailsLoading } = useUserDetails(userId);
  const { data: sessions, isLoading: sessionsLoading } = useUserSessions(userId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);

  const getShortReferrer = (url: string | null) => {
    if (!url) return "Direct";
    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      return hostname;
    } catch {
      return url;
    }
  };

  const getMarketingChannel = (referrer: string | null, utmSource: string | null) => {
    if (utmSource) return utmSource;
    if (!referrer || referrer === "Direct") return "Direct";
    
    const lower = referrer.toLowerCase();
    if (lower.includes("google")) return "Google";
    if (lower.includes("facebook") || lower.includes("fb")) return "Facebook";
    if (lower.includes("linkedin")) return "LinkedIn";
    if (lower.includes("twitter") || lower.includes("x.com")) return "Twitter";
    
    return "Referral";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-background">
        <SheetHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              {userDetails?.first_name ? (
                <span className="text-sm font-medium text-foreground">
                  {(userDetails.first_name[0] || '') + (userDetails.last_name?.[0] || '')}
                </span>
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <SheetTitle className="text-base font-semibold text-foreground">
                {userDetails 
                  ? `${userDetails.first_name} ${userDetails.last_name}`.trim() || "Unidentified"
                  : "Unidentified"}
              </SheetTitle>
              {userDetails?.email && (
                <p className="text-xs text-muted-foreground mt-0.5">{userDetails.email}</p>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Sessions Section */}
        <div className="py-6 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Sessions</h3>
          {sessionsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : sessions && sessions.length > 0 ? (
            <div className="space-y-2">
              {sessions.slice(0, 5).map((session) => (
                <div
                  key={session.session_id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedSessionId(session.session_id);
                    setSessionDialogOpen(true);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {session.session_id.slice(0, 16)}...
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.formatted_time}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {session.event_count} events
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sessions found</p>
          )}
        </div>

        {/* About This User Section */}
        <div className="py-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">About this user</h3>
          {detailsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* User ID */}
              <div className="flex items-start justify-between py-2">
                <span className="text-xs text-muted-foreground">User ID</span>
                <span className="text-xs font-mono text-foreground text-right max-w-[60%] break-all">
                  {userDetails?.id}
                </span>
              </div>

              {/* Date First Seen */}
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Date First Seen
                </span>
                <span className="text-xs font-medium text-foreground">
                  {userDetails?.initial_session?.first_seen_at
                    ? format(new Date(userDetails.initial_session.first_seen_at), "MMMM d, yyyy")
                    : userDetails?.created_at
                    ? format(new Date(userDetails.created_at), "MMMM d, yyyy")
                    : "N/A"}
                </span>
              </div>

              {/* Initial Location */}
              {userDetails?.initial_session?.location && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Initial Location
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {userDetails.initial_session.location.city || "N/A"}
                    {userDetails.initial_session.location.state &&
                      `, ${userDetails.initial_session.location.state}`}
                  </span>
                </div>
              )}

              {/* Initial Referrer */}
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5" />
                  Initial Referrer
                </span>
                <span className="text-xs font-medium text-foreground">
                  {getShortReferrer(userDetails?.initial_session?.referrer || null)}
                </span>
              </div>

              {/* Full Initial Referrer */}
              {userDetails?.initial_session?.full_referrer && (
                <div className="flex items-start justify-between py-2">
                  <span className="text-xs text-muted-foreground">Full Initial Referrer</span>
                  <a
                    href={userDetails.initial_session.full_referrer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 max-w-[60%] break-all text-right"
                  >
                    {userDetails.initial_session.full_referrer}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}

              {/* Initial UTM Source */}
              {userDetails?.initial_session?.utm_source && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Initial UTM Source</span>
                  <span className="text-xs font-medium text-foreground">
                    {userDetails.initial_session.utm_source}
                  </span>
                </div>
              )}

              {/* Initial Landing Page */}
              {userDetails?.initial_session?.landing_page && (
                <div className="flex items-start justify-between py-2">
                  <span className="text-xs text-muted-foreground">Initial Landing Page</span>
                  <a
                    href={userDetails.initial_session.landing_page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 max-w-[60%] break-all text-right"
                  >
                    {userDetails.initial_session.landing_page}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}

              {/* Initial Landing Page Query */}
              {userDetails?.initial_session?.landing_page_query && (
                <div className="flex items-start justify-between py-2">
                  <span className="text-xs text-muted-foreground">Landing Page Query</span>
                  <span className="text-xs font-mono text-foreground text-right max-w-[60%] break-all">
                    {userDetails.initial_session.landing_page_query}
                  </span>
                </div>
              )}

              {/* Initial Browser */}
              {userDetails?.initial_session?.browser && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" />
                    Initial Browser
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {userDetails.initial_session.browser}
                  </span>
                </div>
              )}

              {/* Initial Device Type */}
              {userDetails?.initial_session?.device_type && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" />
                    Initial Device Type
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {userDetails.initial_session.device_type}
                  </span>
                </div>
              )}

              {/* Initial Platform */}
              {userDetails?.initial_session?.platform && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Initial Platform</span>
                  <span className="text-xs font-medium text-foreground">
                    {userDetails.initial_session.platform}
                  </span>
                </div>
              )}

              {/* Custom & Defined Properties */}
              <div className="pt-4 border-t border-border mt-4">
                <h4 className="text-xs font-semibold text-foreground mb-3">
                  Custom & Defined Properties
                </h4>

                {/* Initial Browser Type */}
                {userDetails?.initial_session?.browser_type && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-muted-foreground">Initial Browser Type</span>
                    <span className="text-xs font-medium text-foreground">
                      {userDetails.initial_session.browser_type}
                    </span>
                  </div>
                )}

                {/* Initial Marketing Channel */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Initial Marketing Channel</span>
                  <span className="text-xs font-medium text-foreground">
                    {getMarketingChannel(
                      userDetails?.initial_session?.referrer || null,
                      userDetails?.initial_session?.utm_source || null
                    )}
                  </span>
                </div>

                {/* Buyer Type */}
                {userDetails?.buyer_type && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-muted-foreground">Buyer Type</span>
                    <Badge variant="secondary" className="text-xs">
                      {userDetails.buyer_type}
                    </Badge>
                  </div>
                )}

                {/* Approval Status */}
                {userDetails?.approval_status && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-muted-foreground">Approval Status</span>
                    <Badge
                      variant={
                        userDetails.approval_status === "approved"
                          ? "default"
                          : userDetails.approval_status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {userDetails.approval_status}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
      <SessionEventsDialog
        sessionId={selectedSessionId}
        userId={userId}
        open={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
      />
    </Sheet>
  );
};

export default UserDetailsSidePanel;
