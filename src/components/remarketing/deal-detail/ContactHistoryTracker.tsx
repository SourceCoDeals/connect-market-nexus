import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Mail,
  Phone,
  Linkedin,
  ChevronDown,
  CheckCircle,
  Clock,
  Zap,
  TrendingUp,
  Mic,
  Activity,
} from 'lucide-react';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import {
  useContactCombinedHistory,
  useContactCombinedHistoryByEmail,
  type UnifiedActivityEntry,
} from '@/hooks/use-contact-combined-history';

// ── Types ──

type DateRangeValue = '7d' | '30d' | '90d' | 'all';

interface ContactHistoryTrackerProps {
  listingId: string;
  primaryContactEmail?: string | null;
  primaryContactName?: string | null;
}

// ── Helpers ──

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function getDateRangeCutoff(range: DateRangeValue): Date | null {
  switch (range) {
    case '7d':
      return subDays(new Date(), 7);
    case '30d':
      return subDays(new Date(), 30);
    case '90d':
      return subDays(new Date(), 90);
    case 'all':
    default:
      return null;
  }
}

function filterByDateRange(
  entries: UnifiedActivityEntry[],
  range: DateRangeValue,
): UnifiedActivityEntry[] {
  const cutoff = getDateRangeCutoff(range);
  if (!cutoff) return entries;
  return entries.filter((e) => new Date(e.timestamp) >= cutoff);
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
  let nextBestAction = {
    action: 'Send Email',
    icon: 'mail' as const,
    reason: 'No contact history found. Start with an introductory email.',
    timing: 'as soon as possible',
  };

  if (lastEntry) {
    if (emailsOpened > 0 && emailsReplied === 0 && callsConnected === 0) {
      nextBestAction = {
        action: 'Schedule Call',
        icon: 'phone' as const,
        reason: `Email opened ${emailsOpened}x with no reply. Engagement is high—time to connect directly.`,
        timing: 'within 2 days',
      };
    } else if (totalEmails > 3 && emailsOpened === 0) {
      nextBestAction = {
        action: 'Try LinkedIn',
        icon: 'linkedin' as const,
        reason: 'Multiple emails sent with no opens. Try a different channel to break through.',
        timing: 'within 3 days',
      };
    } else if (callsConnected > 0 && emailsReplied === 0) {
      nextBestAction = {
        action: 'Send Follow-up Email',
        icon: 'mail' as const,
        reason: 'Had a call but no email reply yet. Send a follow-up to keep momentum.',
        timing: 'within 1 day',
      };
    } else if (linkedInReplied > 0) {
      nextBestAction = {
        action: 'Schedule Call',
        icon: 'phone' as const,
        reason: 'Positive LinkedIn engagement. Convert to a phone conversation.',
        timing: 'within 2 days',
      };
    } else if (daysSinceLastContact !== null && daysSinceLastContact > 14) {
      nextBestAction = {
        action: 'Re-engage',
        icon: 'mail' as const,
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

  // Fetch associated buyers for this deal (same pattern as DealContactHistoryTab)
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
        contactEmail: d.contact_email as string | null,
        remarketing_buyer_id: d.remarketing_buyer_id as string | null,
      }));
    },
    enabled: !!listingId,
  });

  // Find the best buyer ID or email for fetching history
  const primaryBuyerId =
    associatedBuyers.find((b) => b.remarketing_buyer_id)?.remarketing_buyer_id || null;
  const lookupEmail =
    primaryContactEmail || associatedBuyers.find((b) => b.contactEmail)?.contactEmail || null;

  // Fetch combined history
  const { data: entriesByBuyer = [], isLoading: historyByBuyerLoading } =
    useContactCombinedHistory(primaryBuyerId);
  const { data: entriesByEmail = [], isLoading: historyByEmailLoading } =
    useContactCombinedHistoryByEmail(!primaryBuyerId ? lookupEmail : null);

  const isLoading = buyersLoading || historyByBuyerLoading || historyByEmailLoading;
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

  if (isLoading) {
    return (
      <div className="min-h-[400px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-2xl p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-800 rounded" />
          <div className="grid grid-cols-2 gap-6">
            <div className="h-40 bg-slate-800/50 rounded-2xl" />
            <div className="h-40 bg-slate-800/50 rounded-2xl" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-slate-800/30 rounded-xl" />
            <div className="h-20 bg-slate-800/30 rounded-xl" />
            <div className="h-20 bg-slate-800/30 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-2xl relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-slate-800/50 bg-slate-900/40 backdrop-blur-xl">
          <div className="px-6 py-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent mb-1">
                Contact History
              </h2>
              <p className="text-slate-400 text-sm">
                {primaryContactName || 'All contacts'} | Activity timeline across all channels
              </p>
            </div>

            {/* Date Range Selector */}
            <div className="flex gap-2">
              {[
                { value: '7d' as const, label: 'Last 7 days' },
                { value: '30d' as const, label: 'Last 30 days' },
                { value: '90d' as const, label: 'Last 90 days' },
                { value: 'all' as const, label: 'All time' },
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => setDateRange(range.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    dateRange === range.value
                      ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Days Since Last Contact */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-teal-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">
                      Days Since Last Contact
                    </span>
                    <Clock className="w-5 h-5 text-blue-400/50" />
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-6xl font-bold text-white">
                      {overview.daysSinceLastContact ?? '—'}
                    </span>
                    {overview.daysSinceLastContact !== null && (
                      <span className="text-slate-400 text-lg">days</span>
                    )}
                  </div>
                  {overview.lastContactDate && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                      <CheckCircle className="w-3 h-3 text-green-400/60" />
                      Last contacted via {overview.lastContactChannel} on{' '}
                      {format(new Date(overview.lastContactDate), 'MMM d')}
                    </div>
                  )}
                  <EngagementBadge status={overview.engagementStatus} />
                </div>
              </div>
            </div>

            {/* Card 2: Next Best Action */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -mr-16 -mt-16" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">
                      Next Best Action
                    </span>
                    <Zap className="w-5 h-5 text-amber-400/50" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/20 border border-amber-500/30">
                      <NextActionIcon type={overview.nextBestAction.icon} />
                      <div className="flex-1">
                        <div className="font-semibold text-white text-sm">
                          {overview.nextBestAction.action}
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          {overview.nextBestAction.reason}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Recommended {overview.nextBestAction.timing}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Emails" value={overview.totalEmails} icon={Mail} color="blue" />
            <StatCard label="Calls" value={overview.totalCalls} icon={Phone} color="orange" />
            <StatCard
              label="LinkedIn"
              value={overview.totalLinkedIn}
              icon={Linkedin}
              color="purple"
            />
          </div>

          {/* Activity Timeline - Collapsible Sections */}
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400 text-sm">No communication activity recorded yet</p>
              <p className="text-slate-500 text-xs mt-1">
                Email, call, and LinkedIn history from SmartLead, PhoneBurner, and HeyReach will
                appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Email Section */}
              {overview.emailEntries.length > 0 && (
                <ChannelSection
                  channel="emails"
                  icon={Mail}
                  title="Email History"
                  emoji="📧"
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

              {/* Call Section */}
              {overview.callEntries.length > 0 && (
                <ChannelSection
                  channel="calls"
                  icon={Phone}
                  title="Call History"
                  emoji="📞"
                  count={overview.callEntries.length}
                  color="orange"
                  expanded={!!expandedSections.calls}
                  onToggle={() => toggleSection('calls')}
                >
                  {overview.callEntries.map((entry) => (
                    <CallEntry key={entry.id} entry={entry} />
                  ))}
                </ChannelSection>
              )}

              {/* LinkedIn Section */}
              {overview.linkedInEntries.length > 0 && (
                <ChannelSection
                  channel="linkedin"
                  icon={Linkedin}
                  title="LinkedIn Activity"
                  emoji="💼"
                  count={overview.linkedInEntries.length}
                  color="purple"
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
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function EngagementBadge({ status }: { status: 'active' | 'warm' | 'cold' | 'none' }) {
  if (status === 'none') return null;

  const config = {
    active: {
      bg: 'bg-emerald-500/20 border-emerald-500/30',
      dot: 'bg-emerald-400',
      text: 'text-emerald-300',
      label: 'Actively Engaged',
    },
    warm: {
      bg: 'bg-amber-500/20 border-amber-500/30',
      dot: 'bg-amber-400',
      text: 'text-amber-300',
      label: 'Warm Lead',
    },
    cold: {
      bg: 'bg-slate-500/20 border-slate-500/30',
      dot: 'bg-slate-400',
      text: 'text-slate-300',
      label: 'Gone Cold',
    },
  }[status];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${config.bg}`}>
      <div className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
      <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
    </div>
  );
}

function NextActionIcon({ type }: { type: 'mail' | 'phone' | 'linkedin' }) {
  const className = 'w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5';
  if (type === 'phone') return <Phone className={className} />;
  if (type === 'linkedin') return <Linkedin className={className} />;
  return <Mail className={className} />;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Mail;
  color: 'blue' | 'orange' | 'purple';
}) {
  const iconColor = {
    blue: 'text-blue-400/50',
    orange: 'text-orange-400/50',
    purple: 'text-purple-400/50',
  }[color];

  return (
    <div className="group bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-xl p-4 hover:border-slate-600/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-xs uppercase tracking-wide font-medium">{label}</span>
        <Icon className={`w-4 h-4 ${iconColor} group-hover:opacity-100 transition-colors`} />
      </div>
      <div className="text-3xl font-bold text-white group-hover:scale-110 transition-transform duration-300 origin-left">
        {value}
      </div>
    </div>
  );
}

function ChannelSection({
  icon: Icon,
  title,
  emoji,
  count,
  color,
  expanded,
  onToggle,
  children,
}: {
  channel: string;
  icon: typeof Mail;
  title: string;
  emoji: string;
  count: number;
  color: 'blue' | 'orange' | 'purple';
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const colorStyles = {
    blue: {
      bg: 'from-blue-500/10 to-transparent',
      border: 'border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/15',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
    },
    orange: {
      bg: 'from-orange-500/10 to-transparent',
      border: 'border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/15',
      iconBg: 'bg-orange-500/20',
      iconColor: 'text-orange-400',
    },
    purple: {
      bg: 'from-purple-500/10 to-transparent',
      border: 'border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/15',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
    },
  }[color];

  return (
    <div>
      <button onClick={onToggle} className="w-full text-left">
        <div
          className={`bg-gradient-to-r ${colorStyles.bg} border ${colorStyles.border} rounded-2xl p-6 transition-all duration-300 cursor-pointer`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${colorStyles.iconBg}`}>
                <Icon className={`w-6 h-6 ${colorStyles.iconColor}`} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">
                  {emoji} {title}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {count} total{' '}
                  {title.toLowerCase().includes('activity')
                    ? 'interactions'
                    : count === 1
                      ? 'entry'
                      : 'entries'}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-6 h-6 text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </button>

      {expanded && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

// ── Entry renderers ──

function EmailEntry({ entry }: { entry: UnifiedActivityEntry }) {
  const isOpened = ['EMAIL_OPENED', 'OPENED'].includes(entry.event_type);
  const isReplied = ['EMAIL_REPLIED', 'REPLIED'].includes(entry.event_type);
  const isSent = entry.event_type === 'EMAIL_SENT';

  return (
    <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 ml-12 hover:border-slate-600/50 transition-all duration-200">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-white text-sm">{entry.label}</h4>
          {entry.context && <p className="text-xs text-slate-500 mt-1">{entry.context}</p>}
          {entry.details.lead_email && (
            <p className="text-xs text-slate-500 mt-0.5">{entry.details.lead_email}</p>
          )}
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap ml-4">
          {format(new Date(entry.timestamp), 'MMM d')} {format(new Date(entry.timestamp), 'h:mm a')}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900/40">
          {isOpened || isReplied ? (
            <>
              <CheckCircle className="w-3 h-3 text-green-400" />
              <span className="text-slate-300">{isReplied ? 'Replied' : 'Opened'}</span>
            </>
          ) : isSent ? (
            <>
              <Mail className="w-3 h-3 text-blue-400" />
              <span className="text-slate-300">Sent</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 text-slate-500" />
              <span className="text-slate-400">{entry.label}</span>
            </>
          )}
        </div>
        <span className="text-slate-500">
          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
        </span>
      </div>
      {isReplied && entry.details.lead_email && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
          <div className="text-xs text-slate-400 mb-1">
            Reply received from {entry.details.lead_email}
          </div>
        </div>
      )}
    </div>
  );
}

function CallEntry({ entry }: { entry: UnifiedActivityEntry }) {
  const isConnected =
    entry.event_type === 'call_completed' && entry.details.call_outcome === 'dispositioned';
  const isVoicemail =
    entry.details.call_outcome === 'no_answer' ||
    entry.details.disposition_code?.toLowerCase().includes('voicemail');

  return (
    <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 ml-12 hover:border-slate-600/50 transition-all duration-200">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">{entry.label}</span>
            <span
              className={`text-xs font-medium ${
                isConnected ? 'text-green-400' : isVoicemail ? 'text-yellow-400' : 'text-slate-400'
              }`}
            >
              {isConnected
                ? 'Connected'
                : isVoicemail
                  ? 'Voicemail'
                  : entry.details.call_outcome || ''}
            </span>
          </div>
          {entry.context && <p className="text-xs text-slate-500 mt-1">{entry.context}</p>}
        </div>
        <span className="text-xs text-slate-400">
          {format(new Date(entry.timestamp), 'MMM d')} {format(new Date(entry.timestamp), 'h:mm a')}
        </span>
      </div>
      {entry.details.call_duration_seconds && entry.details.call_duration_seconds > 0 && (
        <div className="text-xs text-slate-400 mb-3">
          Duration:{' '}
          <span className="text-white font-semibold">
            {formatDuration(entry.details.call_duration_seconds)}
          </span>
        </div>
      )}
      {entry.details.disposition_label && (
        <div className="flex items-center gap-1 text-xs mb-3">
          <span className="px-2 py-0.5 rounded bg-slate-900/40 text-slate-300">
            {entry.details.disposition_label}
          </span>
        </div>
      )}
      {entry.details.disposition_notes && (
        <div className="p-3 rounded-lg bg-slate-900/40">
          <div className="text-xs text-slate-400 mb-1">Notes:</div>
          <div className="text-sm text-white">{entry.details.disposition_notes}</div>
        </div>
      )}
      {entry.details.recording_url && (
        <a
          href={entry.details.recording_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:underline"
        >
          <Mic className="w-3 h-3" />
          Listen to Recording
        </a>
      )}
    </div>
  );
}

function LinkedInEntry({ entry }: { entry: UnifiedActivityEntry }) {
  const isReply = ['MESSAGE_RECEIVED', 'INMAIL_RECEIVED', 'LEAD_REPLIED'].includes(
    entry.event_type,
  );
  const isAccepted = entry.event_type === 'CONNECTION_REQUEST_ACCEPTED';

  const typeLabel =
    {
      CONNECTION_REQUEST_SENT: 'Connection Request Sent',
      CONNECTION_REQUEST_ACCEPTED: 'Connection Accepted',
      MESSAGE_SENT: 'Message Sent',
      MESSAGE_RECEIVED: 'Message Received',
      INMAIL_SENT: 'InMail Sent',
      INMAIL_RECEIVED: 'InMail Received',
      PROFILE_VIEWED: 'Profile Viewed',
      FOLLOW_SENT: 'Followed',
      LIKE_SENT: 'Liked Post',
      LEAD_REPLIED: 'Lead Replied',
      LEAD_INTERESTED: 'Interested',
      LEAD_NOT_INTERESTED: 'Not Interested',
    }[entry.event_type] || entry.label;

  return (
    <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 ml-12 hover:border-slate-600/50 transition-all duration-200">
      <div className="flex justify-between items-start mb-3">
        <span className="font-semibold text-white text-sm">{typeLabel}</span>
        <span className="text-xs text-slate-400">
          {format(new Date(entry.timestamp), 'MMM d')} {format(new Date(entry.timestamp), 'h:mm a')}
        </span>
      </div>
      {entry.context && <p className="text-xs text-slate-500 mb-2">{entry.context}</p>}
      {entry.details.lead_linkedin_url && (
        <p className="text-xs text-slate-500 mb-2 truncate">{entry.details.lead_linkedin_url}</p>
      )}
      {(isReply || isAccepted) && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
          <div className="text-xs text-slate-400 mb-1">
            {isAccepted ? 'Connection accepted' : 'Response received'}
          </div>
        </div>
      )}
    </div>
  );
}
