import { formatDistanceToNow } from "date-fns";
import { Globe, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveSessionsListProps {
  sessions: Array<{
    sessionId: string;
    userId: string | null;
    country: string | null;
    city: string | null;
    lastActiveAt: string;
    durationSeconds: number;
  }>;
}

export function ActiveSessionsList({ sessions }: ActiveSessionsListProps) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Active Sessions
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Currently browsing users
        </p>
      </div>

      <div className="space-y-3 max-h-[220px] overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No active sessions
          </p>
        ) : (
          sessions.map((session, index) => (
            <div 
              key={session.sessionId}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl",
                "bg-muted/30 hover:bg-muted/50 transition-colors"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Status indicator */}
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-coral-400 to-peach-400 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card" />
                </div>
                
                <div>
                  <p className="text-sm font-medium">
                    {session.userId ? 'Registered User' : 'Anonymous'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {session.city && session.country && (
                      <>
                        <Globe className="h-3 w-3" />
                        <span>{session.city}, {session.country}</span>
                      </>
                    )}
                    {!session.city && session.country && (
                      <>
                        <Globe className="h-3 w-3" />
                        <span>{session.country}</span>
                      </>
                    )}
                    {!session.country && (
                      <>
                        <Globe className="h-3 w-3" />
                        <span>Unknown location</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs font-medium">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>{formatDuration(session.durationSeconds)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(session.lastActiveAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
