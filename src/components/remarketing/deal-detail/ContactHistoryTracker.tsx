/**
 * ContactHistoryTracker.tsx
 *
 * Aggregates and displays all outreach activity (emails, calls, LinkedIn messages)
 * for a deal's contacts. Shows overview stats, date-range filtering, and a unified
 * activity timeline across all communication channels.
 *
 * Sub-components extracted to contact-history/:
 *   EngagementBadge, StatCard, ChannelSection, EmailEntry, CallEntry,
 *   LinkedInEntry, SingleContactTimeline, formatDuration, filterByDateRange
 *
 * Data sources:
 *   useContactCombinedHistory / useContactCombinedHistoryByEmail hooks (outreach_events,
 *   call_logs, linkedin_activities tables); ListingNotesLog for listing-level notes
 *
 * Used on:
 *   ReMarketing deal detail page (/admin/remarketing/deals/:id)
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  User,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useContactCombinedHistory,
  useContactCombinedHistoryByEmail,
  type UnifiedActivityEntry,
} from '@/hooks/use-contact-combined-history';
import { ListingNotesLog } from './ListingNotesLog';

// Extracted sub-components
import {
  type DateRangeValue,
  filterByDateRange,
  EngagementBadge,
  StatCard,
  ChannelSection,
  EmailEntry,
  CallEntry,
  LinkedInEntry,
  SingleContactTimeline,
} from './contact-history';

// ── Types ──

interface ContactHistoryTrackerProps {
  listingId: string;
  primaryContactEmail?: string | null;
  primaryContactName?: string | null;
}

interface AssociatedBuyer {
  id: string;
  buyerName: string;
  contactName: string | null;
  contactEmail: string | null;
  remarketing_buyer_id: string | null;
  buyerType: string | null;
}

// ── Helpers ──

function NextActionIcon({ type }: { type: 'mail' | 'phone' | 'linkedin' }) {
  const className = 'w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5';
  if (type === 'phone') return <Phone className={className} />;
  if (type === 'linkedin') return <Linkedin className={className} />;
  return <Mail className={className} />;
}

// Compute overview stats from entries
function computeOverview(entries: UnifiedActivityEntry[]) {
  let totalEmails = 0;
  let totalCalls = 0;
  let totalLinkedIn = 0;
  let emailsOpened = 0;
  let emailsReplied = 0;
  let callsConnected = 0;
  let linkedInReplied = 0;

  const emailEntries: UnifiedActivityEntry[] = [];
  const callEntries: UnifiedActivityEntry[] = [];
  const linkedInEntries: UnifiedActivityEntry[] = [];

  for (const e of entries) {
    if (e.channel === 'email') {
      totalEmails++;
      emailEntries.push(e);
      if (['EMAIL_OPENED', 'OPENED'].includes(e.event_type)) emailsOpened++;
      if (['EMAIL_REPLIED', 'REPLIED'].includes(e.event_type)) emailsReplied++;
    } else if (e.channel === 'linkedin') {
      totalLinkedIn++;
      linkedInEntries.push(e);
      if (['MESSAGE_RECEIVED', 'INMAIL_RECEIVED', 'LEAD_REPLIED'].includes(e.event_type))
        linkedInReplied++;
    } else {
      totalCalls++;
      callEntries.push(e);
      if (e.event_type === 'call_completed') callsConnected++;
    }
  }

  const lastEntry = entries.length > 0 ? entries[0] : null;
  const daysSinceLastContact = lastEntry
    ? Math.floor((Date.now() - new Date(lastEntry.timestamp).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Determine next best action
  let nextBestAction: {
    action: string;
    icon: 'mail' | 'phone' | 'linkedin';
    reason: string;
    timing: string;
  } = {
    action: 'Send Email',
    icon: 'mail',
    reason: 'No contact history found. Start with an introductory email.',
    timing: 'as soon as possible',
  };

  if (lastEntry) {
    if (emailsOpened > 0 && emailsReplied === 0 && callsConnected === 0) {
      nextBestAction = {
        action: 'Schedule Call',
        icon: 'phone',
        reason: `Email opened ${emailsOpened}x with no reply. Engagement is high\u2014time to connect directly.`,
        timing: 'within 2 days',
      };
    } else if (totalEmails > 3 && emailsOpened === 0) {
      nextBestAction = {
        action: 'Try LinkedIn',
        icon: 'linkedin',
        reason: 'Multiple emails sent with no opens. Try a different channel to break through.',
        timing: 'within 3 days',
      };
    } else if (callsConnected > 0 && emailsReplied === 0) {
      nextBestAction = {
        action: 'Send Follow-up Email',
        icon: 'mail',
        reason: 'Had a call but no email reply yet. Send a follow-up to keep momentum.',
        timing: 'within 1 day',
      };
    } else if (linkedInReplied > 0) {
      nextBestAction = {
        action: 'Schedule Call',
        icon: 'phone',
        reason: 'Positive LinkedIn engagement. Convert to a phone conversation.',
        timing: 'within 2 days',
      };
    } else if (daysSinceLastContact !== null && daysSinceLastContact > 14) {
      nextBestAction = {
        action: 'Re-engage',
        icon: 'mail',
        reason: `No contact in ${daysSinceLastContact} days. Time to re-engage before they go cold.`,
        timing: 'today',
      };
    }
  }

  // Engagement status
  let engagementStatus: 'active' | 'warm' | 'cold' | 'none' = 'none';
  if (daysSinceLastContact !== null) {
    if (daysSinceLastContact <= 7) engagementStatus = 'active';
    else if (daysSinceLastContact <= 30) engagementStatus = 'warm';
    else engagementStatus = 'cold';
  }

  return {
    totalEmails,
    totalCalls,
    totalLinkedIn,
    emailsOpened,
    emailsReplied,
    callsConnected,
    linkedInReplied,
    daysSinceLastContact,
    lastContactDate: lastEntry?.timestamp || null,
    lastContactChannel: lastEntry?.channel || null,
    nextBestAction,
    engagementStatus,
    emailEntries,
    callEntries,
    linkedInEntries,
  };
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

  // Fetch associated buyers for this deal
  const { data: associatedBuyers = [], isLoading: buyersLoading } = useQuery({
    queryKey: ['contact-history-tracker-buyers', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(
          `
          id,
          contact_name,
          contact_email,
          contact_phone,
          remarketing_buyer_id,
          remarketing_buyers!deals_remarketing_buyer_id_fkey ( company_name, buyer_type )
        `,
        )
        .eq('listing_id', listingId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        buyerName:
          ((d.remarketing_buyers as Record<string, unknown> | null)?.company_name as string) ||
          (d.contact_name as string) ||
          'Unknown',
        contactName: d.contact_name as string | null,
        contactEmail: d.contact_email as string | null,
        remarketing_buyer_id: d.remarketing_buyer_id as string | null,
        buyerType:
          ((d.remarketing_buyers as Record<string, unknown> | null)?.buyer_type as string) || null,
      }));
    },
    enabled: !!listingId,
  });

  // Fetch seller-side contacts
  const { data: sellerContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['contact-history-tracker-seller', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, title, contact_type')
        .eq('listing_id', listingId)
        .eq('archived', false)
        .order('is_primary_seller_contact', { ascending: false });

      if (error) throw error;

      return (data || []).map((c) => ({
        id: c.id as string,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
        email: c.email as string | null,
        phone: c.phone as string | null,
        title: c.title as string | null,
        contactType: c.contact_type as string | null,
      }));
    },
    enabled: !!listingId,
  });

  // Find the best buyer ID or email for the overview
  const primaryBuyerId =
    associatedBuyers.find((b) => b.remarketing_buyer_id)?.remarketing_buyer_id || null;
  const lookupEmail =
    primaryContactEmail || associatedBuyers.find((b) => b.contactEmail)?.contactEmail || null;

  // Fetch combined history for overview stats
  const { data: entriesByBuyer = [], isLoading: historyByBuyerLoading } =
    useContactCombinedHistory(primaryBuyerId);
  const { data: entriesByEmail = [], isLoading: historyByEmailLoading } =
    useContactCombinedHistoryByEmail(!primaryBuyerId ? lookupEmail : null);

  const isLoading =
    buyersLoading || contactsLoading || historyByBuyerLoading || historyByEmailLoading;
  const allEntries = primaryBuyerId ? entriesByBuyer : entriesByEmail;

  // Filter by date range
  const filteredEntries = useMemo(
    () => filterByDateRange(allEntries, dateRange),
    [allEntries, dateRange],
  );

  // Compute overview from filtered entries
  const overview = useMemo(() => computeOverview(filteredEntries), [filteredEntries]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Build contact tabs for the per-contact activity log section
  const allContactEmails = new Set<string>();
  if (primaryContactEmail) allContactEmails.add(primaryContactEmail.toLowerCase());

  const uniqueBuyers: AssociatedBuyer[] = [];
  for (const b of associatedBuyers) {
    const email = b.contactEmail?.toLowerCase();
    if (email && allContactEmails.has(email)) continue;
    if (email) allContactEmails.add(email);
    uniqueBuyers.push(b);
  }

  type ContactTab = {
    id: string;
    label: string;
    email?: string | null;
    buyerId?: string | null;
    type: 'primary' | 'buyer' | 'seller';
  };

  const contactTabs: ContactTab[] = [];

  if (primaryContactEmail) {
    contactTabs.push({
      id: 'primary',
      label: primaryContactName || 'Primary Contact',
      email: primaryContactEmail,
      type: 'primary',
    });
  }

  for (const b of uniqueBuyers) {
    contactTabs.push({
      id: `buyer-${b.id}`,
      label: b.contactName || b.buyerName,
      email: b.contactEmail,
      buyerId: b.remarketing_buyer_id,
      type: 'buyer',
    });
  }

  for (const c of sellerContacts) {
    if (allContactEmails.has(c.email?.toLowerCase() || '')) continue;
    contactTabs.push({
      id: `seller-${c.id}`,
      label: c.name,
      email: c.email,
      type: 'seller',
    });
  }

  const [activeContactTab, setActiveContactTab] = useState<string>('');
  const effectiveContactTab = activeContactTab || (contactTabs.length > 0 ? contactTabs[0].id : '');
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
                  <CheckCircle className="w-3 h-3 text-green-500" />
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
              <div className="flex gap-2 flex-wrap mb-4">
                {contactTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveContactTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      effectiveContactTab === tab.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">{tab.label}</span>
                    {tab.type === 'primary' && (
                      <Badge variant="default" className="text-[8px] px-1 py-0 h-4 ml-1">
                        Primary
                      </Badge>
                    )}
                    {tab.type === 'buyer' && (
                      <Badge
                        variant="outline"
                        className="text-[8px] px-1 py-0 h-4 ml-1 border-blue-200 text-blue-700"
                      >
                        Buyer
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              {/* Contact info header */}
              {activeContact && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activeContact.label}</p>
                    {activeContact.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {activeContact.email}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
