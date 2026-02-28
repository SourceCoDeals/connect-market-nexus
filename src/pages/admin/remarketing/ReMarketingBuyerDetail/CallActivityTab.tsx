import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneCall, Clock, Users, CalendarClock } from "lucide-react";
import { useContactCallStats } from "@/hooks/use-contact-call-stats";
import { ContactActivityTimeline } from "@/components/remarketing/ContactActivityTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface CallActivityTabProps {
  buyerId: string;
}

function formatTalkTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export function CallActivityTab({ buyerId }: CallActivityTabProps) {
  const { data: stats, isLoading } = useContactCallStats(buyerId);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : stats && stats.totalCalls > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Phone className="h-3.5 w-3.5" />
                Total Calls
              </div>
              <p className="text-2xl font-bold">{stats.totalCalls}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <PhoneCall className="h-3.5 w-3.5" />
                Connected
              </div>
              <p className="text-2xl font-bold">
                {stats.connectedCalls}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({stats.connectionRate}%)
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Clock className="h-3.5 w-3.5" />
                Talk Time
              </div>
              <p className="text-2xl font-bold">{formatTalkTime(stats.totalTalkTimeSeconds)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Callbacks
              </div>
              <p className="text-2xl font-bold">{stats.upcomingCallbacks}</p>
              {stats.lastCallDate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last: {formatDistanceToNow(new Date(stats.lastCallDate), { addSuffix: true })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Disposition Breakdown */}
      {stats && Object.keys(stats.dispositionBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Disposition Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.dispositionBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([label, count]) => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calls by Rep */}
      {stats && Object.keys(stats.callsByRep).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Calls by Rep
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.callsByRep)
                .sort(([, a], [, b]) => b - a)
                .map(([rep, count]) => (
                  <Badge key={rep} variant="outline" className="text-xs">
                    {rep}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Timeline */}
      <ContactActivityTimeline
        buyerId={buyerId}
        title="PhoneBurner Call Activity"
        maxHeight={600}
      />
    </div>
  );
}
