import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Mail,
  MailOpen,
  MousePointerClick,
  Reply,
  AlertTriangle,
  Ban,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  Activity,
  Linkedin,
  UserPlus,
  MessageSquare,
  Eye,
  Heart,
  Send,
  ChevronDown,
  FileText,
  CalendarClock,
  Video,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useContactCombinedHistory,
  useContactCombinedHistoryByEmail,
  type UnifiedActivityEntry,
} from '@/hooks/use-contact-combined-history';
import { useActivityStats } from '@/hooks/use-activity-stats';
import {
  filterByDateRange,
  type DateRangeValue,
} from '@/components/remarketing/deal-detail/useContactHistory';

// ── Icon + color config for email events ──

const EMAIL_ICON_MAP: Record<string, { icon: typeof Mail; color: string }> = {
  EMAIL_SENT: { icon: Mail, color: 'text-blue-600 bg-blue-50' },
  EMAIL_OPENED: { icon: MailOpen, color: 'text-emerald-600 bg-emerald-50' },
  OPENED: { icon: MailOpen, color: 'text-emerald-600 bg-emerald-50' },
  LINK_CLICKED: { icon: MousePointerClick, color: 'text-violet-600 bg-violet-50' },
  CLICKED: { icon: MousePointerClick, color: 'text-violet-600 bg-violet-50' },
  EMAIL_REPLIED: { icon: Reply, color: 'text-primary bg-primary/10' },
  REPLIED: { icon: Reply, color: 'text-primary bg-primary/10' },
  EMAIL_BOUNCED: { icon: AlertTriangle, color: 'text-destructive bg-red-50' },
  BOUNCED: { icon: AlertTriangle, color: 'text-destructive bg-red-50' },
  UNSUBSCRIBED: { icon: Ban, color: 'text-amber-600 bg-amber-50' },
  INTERESTED: { icon: ThumbsUp, color: 'text-emerald-600 bg-emerald-50' },
  NOT_INTERESTED: { icon: ThumbsDown, color: 'text-muted-foreground bg-muted' },
  MANUAL_STEP_REACHED: { icon: Clock, color: 'text-amber-600 bg-amber-50' },
};

// ── Icon + color config for LinkedIn/HeyReach events ──

const LINKEDIN_ICON_MAP: Record<string, { icon: typeof Mail; color: string }> = {
  CONNECTION_REQUEST_SENT: { icon: UserPlus, color: 'text-blue-700 bg-blue-50' },
  CONNECTION_REQUEST_ACCEPTED: { icon: UserPlus, color: 'text-emerald-600 bg-emerald-50' },
  MESSAGE_SENT: { icon: Send, color: 'text-blue-600 bg-blue-50' },
  MESSAGE_RECEIVED: { icon: MessageSquare, color: 'text-primary bg-primary/10' },
  INMAIL_SENT: { icon: Send, color: 'text-violet-600 bg-violet-50' },
  INMAIL_RECEIVED: { icon: MessageSquare, color: 'text-violet-600 bg-violet-50' },
  PROFILE_VIEWED: { icon: Eye, color: 'text-amber-600 bg-amber-50' },
  FOLLOW_SENT: { icon: UserPlus, color: 'text-blue-500 bg-blue-50' },
  LIKE_SENT: { icon: Heart, color: 'text-rose-500 bg-rose-50' },
  LEAD_REPLIED: { icon: Reply, color: 'text-primary bg-primary/10' },
  LEAD_INTERESTED: { icon: ThumbsUp, color: 'text-emerald-600 bg-emerald-50' },
  LEAD_NOT_INTERESTED: { icon: ThumbsDown, color: 'text-muted-foreground bg-muted' },
};

function getCallIcon(eventType: string, outcome: string | null) {
  if (eventType === 'call_completed' && outcome === 'dispositioned') {
    return { icon: PhoneCall, color: 'text-primary bg-primary/10' };
  }
  if (outcome === 'no_answer' || outcome === 'busy') {
    return { icon: PhoneOff, color: 'text-muted-foreground bg-muted' };
  }
  return { icon: Phone, color: 'text-blue-600 bg-blue-50' };
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Stats computation now uses shared useActivityStats hook

// ── Individual timeline entry ──

function TimelineEntry({ entry }: { entry: UnifiedActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isEmail = entry.channel === 'email';
  const isLinkedIn = entry.channel === 'linkedin';
  const isCall = entry.channel === 'call';
  const isMeeting = entry.channel === 'meeting';

  const iconConfig = isMeeting
    ? { icon: Video, color: 'text-purple-600 bg-purple-50' }
    : isLinkedIn
      ? LINKEDIN_ICON_MAP[entry.event_type] || { icon: Linkedin, color: 'text-blue-700 bg-blue-50' }
      : isEmail
        ? EMAIL_ICON_MAP[entry.event_type] || {
            icon: Mail,
            color: 'text-muted-foreground bg-muted',
          }
        : getCallIcon(entry.event_type, entry.details.call_outcome || null);

  const Icon = iconConfig.icon;

  const hasExpandableContent =
    isCall && (entry.details.call_transcript || entry.details.contact_notes);

  return (
    <div className="flex items-start gap-3 py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div
        className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${iconConfig.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{entry.label}</span>
          <Badge
            variant="outline"
            className={`text-[10px] ${isLinkedIn ? 'border-blue-300 text-blue-800' : isEmail ? 'border-blue-200 text-blue-700' : 'border-green-200 text-green-700'}`}
          >
            {isLinkedIn ? 'LinkedIn' : isEmail ? 'Email' : 'Call'}
          </Badge>
          {/* Call disposition */}
          {isCall && (entry.details.disposition_label || entry.details.phoneburner_status) && (
            <Badge
              variant={
                entry.details.disposition_code?.includes('INTERESTED')
                  ? 'default'
                  : entry.details.disposition_code?.includes('NOT')
                    ? 'destructive'
                    : 'secondary'
              }
              className="text-[10px]"
            >
              {entry.details.disposition_label || entry.details.phoneburner_status}
            </Badge>
          )}
          {/* Connected badge */}
          {isCall && entry.details.call_connected && (
            <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700">
              Connected
            </Badge>
          )}
          {/* Call duration + talk time */}
          {isCall && entry.details.call_duration_seconds ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(entry.details.call_duration_seconds)}
              {entry.details.talk_time_seconds
                ? ` (talk: ${formatDuration(entry.details.talk_time_seconds)})`
                : ''}
            </span>
          ) : null}
          {/* Recording */}
          {isCall && (entry.details.recording_url || entry.details.recording_url_public) ? (
            <a
              href={entry.details.recording_url_public || entry.details.recording_url || ''}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Mic className="h-3 w-3" />
              Recording
            </a>
          ) : null}
          {/* Transcript indicator */}
          {isCall && entry.details.call_transcript && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Transcript
            </span>
          )}
          {/* Callback date */}
          {isCall && entry.details.callback_scheduled_date && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              Callback: {format(new Date(entry.details.callback_scheduled_date), 'MMM d, h:mm a')}
            </span>
          )}
        </div>
        {/* Context (campaign name, caller) */}
        {entry.context && <p className="text-xs text-muted-foreground">{entry.context}</p>}
        {/* Disposition notes */}
        {entry.details.disposition_notes && (
          <p className="text-xs text-muted-foreground line-clamp-2 italic">
            {entry.details.disposition_notes}
          </p>
        )}
        {/* Expandable transcript/notes */}
        {hasExpandableContent && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
              <ChevronDown
                className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
              {expanded ? 'Hide details' : 'Show transcript & notes'}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {entry.details.call_transcript && (
                <div className="rounded-md bg-muted/50 p-3 text-xs text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                  <p className="font-medium text-muted-foreground mb-1">Transcript</p>
                  {entry.details.call_transcript}
                </div>
              )}
              {entry.details.contact_notes && (
                <div className="rounded-md bg-muted/50 p-3 text-xs text-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                  <p className="font-medium text-muted-foreground mb-1">Contact Notes</p>
                  {entry.details.contact_notes}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
        {/* Timestamp */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component: by buyer ID ──

interface ContactActivityTimelineProps {
  buyerId: string;
  title?: string;
  maxHeight?: number;
  compact?: boolean;
  showDateFilter?: boolean;
}

export function ContactActivityTimeline({
  buyerId,
  title = 'Contact Activity Timeline',
  maxHeight = 500,
  compact = false,
  showDateFilter = false,
}: ContactActivityTimelineProps) {
  const { data: entries = [], isLoading } = useContactCombinedHistory(buyerId);
  return (
    <TimelineCard
      entries={entries}
      isLoading={isLoading}
      title={title}
      maxHeight={maxHeight}
      compact={compact}
      showDateFilter={showDateFilter}
    />
  );
}

// ── Variant: by email ──

interface ContactActivityTimelineByEmailProps {
  email: string;
  title?: string;
  maxHeight?: number;
  compact?: boolean;
  showDateFilter?: boolean;
}

export function ContactActivityTimelineByEmail({
  email,
  title = 'Contact Activity Timeline',
  maxHeight = 500,
  compact = false,
  showDateFilter = false,
}: ContactActivityTimelineByEmailProps) {
  const { data: entries = [], isLoading } = useContactCombinedHistoryByEmail(email);
  return (
    <TimelineCard
      entries={entries}
      isLoading={isLoading}
      title={title}
      maxHeight={maxHeight}
      compact={compact}
      showDateFilter={showDateFilter}
    />
  );
}

// ── Shared card renderer ──

const DATE_RANGE_OPTIONS: { value: DateRangeValue; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

function TimelineCard({
  entries,
  isLoading,
  title,
  maxHeight,
  compact,
  showDateFilter = false,
}: {
  entries: UnifiedActivityEntry[];
  isLoading: boolean;
  title: string;
  maxHeight: number;
  compact: boolean;
  showDateFilter?: boolean;
}) {
  const [dateRange, setDateRange] = useState<DateRangeValue>('all');
  // Optional channel filter. Clicking a badge toggles to that channel;
  // clicking the same badge again clears back to "all". Stats are always
  // computed against the date-filtered set so counts on badges stay accurate
  // after a channel filter is active.
  const [channelFilter, setChannelFilter] = useState<
    'email' | 'call' | 'linkedin' | 'meeting' | null
  >(null);
  const dateFiltered = showDateFilter ? filterByDateRange(entries, dateRange) : entries;
  const stats = useActivityStats(dateFiltered);
  const filtered = channelFilter
    ? dateFiltered.filter((e) => e.channel === channelFilter)
    : dateFiltered;
  const toggleChannel = (c: 'email' | 'call' | 'linkedin' | 'meeting') =>
    setChannelFilter((prev) => (prev === c ? null : c));

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No communication activity recorded yet</p>
            <p className="text-xs mt-1">
              Email, call, LinkedIn, and meeting history will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showDateFilter && (
              <div className="flex items-center gap-0.5 mr-2">
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={dateRange === opt.value ? 'default' : 'ghost'}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setDateRange(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            )}
            {/* Badges double as channel filters — click to toggle. The
                outlined variant highlights the active filter so it's obvious
                which channel is selected. */}
            {stats.totalEmails > 0 && (
              <Badge
                variant={channelFilter === 'email' ? 'default' : 'outline'}
                className="text-xs border-blue-200 text-blue-700 cursor-pointer"
                onClick={() => toggleChannel('email')}
              >
                <Mail className="h-3 w-3 mr-1" />
                {stats.totalEmails} email{stats.totalEmails !== 1 ? 's' : ''}
              </Badge>
            )}
            {stats.totalCalls > 0 && (
              <Badge
                variant={channelFilter === 'call' ? 'default' : 'outline'}
                className="text-xs border-green-200 text-green-700 cursor-pointer"
                onClick={() => toggleChannel('call')}
              >
                <Phone className="h-3 w-3 mr-1" />
                {stats.totalCalls} call{stats.totalCalls !== 1 ? 's' : ''}
              </Badge>
            )}
            {stats.totalLinkedIn > 0 && (
              <Badge
                variant={channelFilter === 'linkedin' ? 'default' : 'outline'}
                className="text-xs border-blue-300 text-blue-800 cursor-pointer"
                onClick={() => toggleChannel('linkedin')}
              >
                <Linkedin className="h-3 w-3 mr-1" />
                {stats.totalLinkedIn} LinkedIn
              </Badge>
            )}
            {stats.totalMeetings > 0 && (
              <Badge
                variant={channelFilter === 'meeting' ? 'default' : 'outline'}
                className="text-xs border-purple-200 text-purple-700 cursor-pointer"
                onClick={() => toggleChannel('meeting')}
              >
                <Video className="h-3 w-3 mr-1" />
                {stats.totalMeetings} meeting{stats.totalMeetings !== 1 ? 's' : ''}
              </Badge>
            )}
            {channelFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setChannelFilter(null)}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        {/* Summary stats row */}
        {!compact && (
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {stats.emailsOpened > 0 && (
              <span className="flex items-center gap-1">
                <MailOpen className="h-3 w-3 text-emerald-500" />
                {stats.emailsOpened} opened
              </span>
            )}
            {stats.emailsReplied > 0 && (
              <span className="flex items-center gap-1">
                <Reply className="h-3 w-3 text-primary" />
                {stats.emailsReplied} replied
              </span>
            )}
            {stats.callsConnected > 0 && (
              <span className="flex items-center gap-1">
                <PhoneCall className="h-3 w-3 text-primary" />
                {stats.callsConnected} connected
              </span>
            )}
            {stats.linkedInConnected > 0 && (
              <span className="flex items-center gap-1">
                <UserPlus className="h-3 w-3 text-blue-700" />
                {stats.linkedInConnected} LI connected
              </span>
            )}
            {stats.linkedInReplied > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-blue-700" />
                {stats.linkedInReplied} LI replied
              </span>
            )}
            {stats.lastContactDate && (
              <span className="ml-auto">
                Last touch:{' '}
                {formatDistanceToNow(new Date(stats.lastContactDate), { addSuffix: true })}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div
          className="overflow-y-auto divide-y divide-border"
          style={{ maxHeight: maxHeight - 140 }}
        >
          {filtered.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
