/**
 * ContactHistoryTracker.tsx
 *
 * Aggregates and displays all outreach activity (emails, calls, LinkedIn messages)
 * for a deal's contacts. Shows overview stats, date-range filtering, and a unified
 * activity timeline across all communication channels.
 *
 * Data sources:
 *   useContactCombinedHistory / useContactCombinedHistoryByEmail hooks (outreach_events,
 *   call_logs, linkedin_activities tables); ListingNotesLog for listing-level notes
 *
 * Used on:
 *   ReMarketing deal detail page (/admin/remarketing/deals/:id)
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail,
  Phone,
  Linkedin,
  CheckCircle,
  Clock,
  Zap,
  TrendingUp,
  Activity,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { ListingNotesLog } from './ListingNotesLog';
import { useContactHistory, type DateRangeValue } from './useContactHistory';
import {
  EngagementBadge,
  NextActionIcon,
  StatCard,
  ChannelSection,
  EmailEntry,
  CallEntry,
  LinkedInEntry,
  SingleContactTimeline,
  ContactTabSelector,
  ActiveContactHeader,
} from './ContactTimeline';

// ── Types ──

interface ContactHistoryTrackerProps {
  listingId: string;
  primaryContactEmail?: string | null;
  primaryContactName?: string | null;
}

// ── Main component ──

export function ContactHistoryTracker({
  listingId,
  primaryContactEmail,
  primaryContactName,
}: ContactHistoryTrackerProps) {
  const [dateRange, setDateRange] = useState<DateRangeValue>('30d');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    emails: true,
  });
  const [activeContactTab, setActiveContactTab] = useState<string>('');

  const { isLoading, filteredEntries, overview, contactTabs } = useContactHistory(
    listingId,
    primaryContactEmail,
    dateRange,
    primaryContactName,
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const effectiveContactTab =
    activeContactTab || (contactTabs.length > 0 ? contactTabs[0].id : '');
  const activeContact = contactTabs.find((t) => t.id === effectiveContactTab);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview & Stats Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Contact History
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {primaryContactName || 'All contacts'} | Activity across all channels
            </p>
          </div>

          {/* Date Range Selector */}
          <div className="flex gap-2 mt-3">
            {[
              { value: '7d' as const, label: 'Last 7 days' },
              { value: '30d' as const, label: 'Last 30 days' },
              { value: '90d' as const, label: 'Last 90 days' },
              { value: 'all' as const, label: 'All time' },
            ].map((range) => (
              <button
                key={range.value}
                onClick={() => setDateRange(range.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  dateRange === range.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Days Since Last Contact */}
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Days Since Last Contact
                </span>
                <Clock className="w-4 h-4 text-muted-foreground/50" />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold">
                  {overview.daysSinceLastContact ?? '\u2014'}
                </span>
                {overview.daysSinceLastContact !== null && (
                  <span className="text-muted-foreground text-sm">days</span>
                )}
              </div>
              {overview.lastContactDate && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                  <Clock className="w-3 h-3 text-green-500" />
                  Last contacted via {overview.lastContactChannel} on{' '}
                  {format(new Date(overview.lastContactDate), 'MMM d')}
                </div>
              )}
              <EngagementBadge status={overview.engagementStatus} />
            </div>

            {/* Next Best Action */}
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Next Best Action
                </span>
                <Zap className="w-4 h-4 text-amber-500/50" />
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                  <NextActionIcon type={overview.nextBestAction.icon} />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{overview.nextBestAction.action}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {overview.nextBestAction.reason}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Recommended {overview.nextBestAction.timing}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Emails" value={overview.totalEmails} icon={Mail} color="blue" />
            <StatCard label="Calls" value={overview.totalCalls} icon={Phone} color="green" />
            <StatCard
              label="LinkedIn"
              value={overview.totalLinkedIn}
              icon={Linkedin}
              color="violet"
            />
          </div>

          {/* Activity Sections - Collapsible */}
          {filteredEntries.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No communication activity recorded yet</p>
              <p className="text-xs mt-1">
                Email, call, and LinkedIn history from SmartLead, PhoneBurner, and HeyReach will
                appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {overview.emailEntries.length > 0 && (
                <ChannelSection
                  icon={Mail}
                  title="Email History"
                  count={overview.emailEntries.length}
                  color="blue"
                  expanded={!!expandedSections.emails}
                  onToggle={() => toggleSection('emails')}
                >
                  {overview.emailEntries.map((entry) => (
                    <EmailEntry key={entry.id} entry={entry} />
                  ))}
                </ChannelSection>
              )}

              {overview.callEntries.length > 0 && (
                <ChannelSection
                  icon={Phone}
                  title="Call History"
                  count={overview.callEntries.length}
                  color="green"
                  expanded={!!expandedSections.calls}
                  onToggle={() => toggleSection('calls')}
                >
                  {overview.callEntries.map((entry) => (
                    <CallEntry key={entry.id} entry={entry} />
                  ))}
                </ChannelSection>
              )}

              {overview.linkedInEntries.length > 0 && (
                <ChannelSection
                  icon={Linkedin}
                  title="LinkedIn Activity"
                  count={overview.linkedInEntries.length}
                  color="violet"
                  expanded={!!expandedSections.linkedin}
                  onToggle={() => toggleSection('linkedin')}
                >
                  {overview.linkedInEntries.map((entry) => (
                    <LinkedInEntry key={entry.id} entry={entry} />
                  ))}
                </ChannelSection>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Contact Activity Log */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contact Activity Log
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {contactTabs.length} contact{contactTabs.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Per-contact email, call, and LinkedIn history from SmartLead, PhoneBurner, and HeyReach
          </p>
        </CardHeader>
        <CardContent>
          {contactTabs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No contacts associated with this deal yet</p>
              <p className="text-xs mt-1">
                Add a primary contact or associate buyers to see their activity here
              </p>
            </div>
          ) : contactTabs.length === 1 ? (
            <SingleContactTimeline tab={contactTabs[0]} />
          ) : (
            <>
              {/* Contact selector */}
              <ContactTabSelector
                tabs={contactTabs}
                activeTabId={effectiveContactTab}
                onSelect={setActiveContactTab}
              />

              {/* Contact info header */}
              {activeContact && <ActiveContactHeader tab={activeContact} />}

              {/* Timeline for active contact */}
              {activeContact && <SingleContactTimeline tab={activeContact} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <ListingNotesLog listingId={listingId} />
    </div>
  );
}
