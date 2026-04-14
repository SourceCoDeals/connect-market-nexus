import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Users, CalendarClock, Mail, Linkedin, Video } from 'lucide-react';
import { useContactCallStats } from '@/hooks/use-contact-call-stats';
import { useContactCombinedHistory } from '@/hooks/use-contact-combined-history';
import { useActivityStats } from '@/hooks/use-activity-stats';
import { ContactActivityTimeline } from '@/components/remarketing/ContactActivityTimeline';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

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
  const { data: callStats, isLoading: callStatsLoading } = useContactCallStats(buyerId);
  const { data: entries = [], isLoading: historyLoading } = useContactCombinedHistory(buyerId);
  const stats = useActivityStats(entries);
  const isLoading = callStatsLoading || historyLoading;

  return (
    <div className="space-y-4">
      {/* Cross-channel summary */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Mail className="h-3.5 w-3.5" />
                Emails
              </div>
              <p className="text-2xl font-bold">{stats.totalEmails}</p>
              {stats.emailsOpened > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.emailsOpened} opened, {stats.emailsReplied} replied
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Phone className="h-3.5 w-3.5" />
                Calls
              </div>
              <p className="text-2xl font-bold">
                {stats.totalCalls}
                {callStats && callStats.totalCalls > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({callStats.connectionRate}% connected)
                  </span>
                )}
              </p>
              {callStats && callStats.totalTalkTimeSeconds > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatTalkTime(callStats.totalTalkTimeSeconds)} talk time
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Linkedin className="h-3.5 w-3.5" />
                LinkedIn
              </div>
              <p className="text-2xl font-bold">{stats.totalLinkedIn}</p>
              {(stats.linkedInConnected > 0 || stats.linkedInReplied > 0) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.linkedInConnected > 0 ? `${stats.linkedInConnected} connected` : ''}
                  {stats.linkedInConnected > 0 && stats.linkedInReplied > 0 ? ', ' : ''}
                  {stats.linkedInReplied > 0 ? `${stats.linkedInReplied} replied` : ''}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                {stats.totalMeetings > 0 ? (
                  <Video className="h-3.5 w-3.5" />
                ) : (
                  <CalendarClock className="h-3.5 w-3.5" />
                )}
                {stats.totalMeetings > 0 ? 'Meetings' : 'Callbacks'}
              </div>
              <p className="text-2xl font-bold">
                {stats.totalMeetings > 0 ? stats.totalMeetings : callStats?.upcomingCallbacks || 0}
              </p>
              {stats.lastContactDate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last: {formatDistanceToNow(new Date(stats.lastContactDate), { addSuffix: true })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Disposition Breakdown (call-specific) */}
      {callStats && Object.keys(callStats.dispositionBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Disposition Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(callStats.dispositionBreakdown)
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
      {callStats && Object.keys(callStats.callsByRep).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Calls by Rep
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(callStats.callsByRep)
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

      {/* Full Timeline (all channels) */}
      <ContactActivityTimeline
        buyerId={buyerId}
        title="Communication History"
        maxHeight={600}
        showDateFilter
      />
    </div>
  );
}
