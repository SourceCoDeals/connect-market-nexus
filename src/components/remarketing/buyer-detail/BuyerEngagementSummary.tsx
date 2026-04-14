import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Video, Linkedin, Clock, Globe } from 'lucide-react';
import type { UnifiedActivityEntry } from '@/hooks/use-contact-combined-history';

interface BuyerEngagementSummaryProps {
  entries: UnifiedActivityEntry[];
  activeDealCount?: number;
  /**
   * Phase 4: number of firm_domain_aliases entries feeding `entries`. When
   * > 0, this component surfaces a "firm touchpoints" badge so users can
   * see that the count reflects activity across every contact at the
   * firm's domains — not just this buyer row's primary contact.
   */
  firmDomainCount?: number;
}

export function BuyerEngagementSummary({
  entries,
  activeDealCount,
  firmDomainCount,
}: BuyerEngagementSummaryProps) {
  const stats = useMemo(() => {
    const calls = entries.filter((e) => e.channel === 'call');
    const meetings = entries.filter((e) => e.channel === 'meeting');
    const emails = entries.filter((e) => e.channel === 'email');
    const linkedin = entries.filter((e) => e.channel === 'linkedin');
    const lastEntry = entries[0] || null;
    const daysSince = lastEntry
      ? Math.floor((Date.now() - new Date(lastEntry.timestamp).getTime()) / 86400000)
      : null;

    return {
      totalCalls: calls.length,
      totalMeetings: meetings.length,
      totalEmails: emails.length,
      totalLinkedIn: linkedin.length,
      lastContact: lastEntry?.timestamp || null,
      lastChannel: lastEntry?.channel || null,
      daysSinceContact: daysSince,
    };
  }, [entries]);

  if (entries.length === 0) return null;

  const urgencyColor =
    stats.daysSinceContact === null
      ? 'text-muted-foreground'
      : stats.daysSinceContact <= 7
        ? 'text-green-600'
        : stats.daysSinceContact <= 14
          ? 'text-yellow-600'
          : 'text-red-600';

  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-4 flex-wrap text-sm">
          {stats.totalCalls > 0 && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-blue-600" />
              <span className="font-medium">{stats.totalCalls}</span> calls
            </span>
          )}
          {stats.totalEmails > 0 && (
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-green-600" />
              <span className="font-medium">{stats.totalEmails}</span> emails
            </span>
          )}
          {stats.totalMeetings > 0 && (
            <span className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-teal-600" />
              <span className="font-medium">{stats.totalMeetings}</span> meetings
            </span>
          )}
          {stats.totalLinkedIn > 0 && (
            <span className="flex items-center gap-1.5">
              <Linkedin className="h-3.5 w-3.5 text-indigo-600" />
              <span className="font-medium">{stats.totalLinkedIn}</span> LinkedIn
            </span>
          )}

          <span className="ml-auto flex items-center gap-1.5">
            <Clock className={`h-3.5 w-3.5 ${urgencyColor}`} />
            <span className={urgencyColor}>
              {stats.daysSinceContact !== null
                ? `${stats.daysSinceContact}d since last contact`
                : 'No contact recorded'}
            </span>
          </span>
          {firmDomainCount != null && firmDomainCount > 0 && (
            <Badge
              variant="outline"
              className="text-xs border-blue-200 text-blue-700 bg-blue-50/60 dark:bg-blue-950/20 dark:text-blue-200 dark:border-blue-800"
              title={`Activity counts include every contact across ${firmDomainCount} firm domain${firmDomainCount === 1 ? '' : 's'}.`}
            >
              <Globe className="h-3 w-3 mr-1" />
              Firm-wide ({firmDomainCount} domain{firmDomainCount === 1 ? '' : 's'})
            </Badge>
          )}
          {activeDealCount != null && activeDealCount > 1 && (
            <Badge variant="outline" className="text-xs">
              Active on {activeDealCount} deals
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
