import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useContactCombinedHistory,
  useContactCombinedHistoryByEmail,
  type UnifiedActivityEntry,
} from '@/hooks/use-contact-combined-history';

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

// ── Summary stats ──

interface ActivityStats {
  totalEmails: number;
  totalCalls: number;
  totalLinkedIn: number;
  emailsOpened: number;
  emailsReplied: number;
  callsConnected: number;
  linkedInConnected: number;
  linkedInReplied: number;
  lastTouch: string | null;
}

function computeStats(entries: UnifiedActivityEntry[]): ActivityStats {
  let totalEmails = 0;
  let totalCalls = 0;
  let totalLinkedIn = 0;
  let emailsOpened = 0;
  let emailsReplied = 0;
  let callsConnected = 0;
  let linkedInConnected = 0;
  let linkedInReplied = 0;

  for (const e of entries) {
    if (e.channel === 'email') {
      totalEmails++;
      if (['EMAIL_OPENED', 'OPENED'].includes(e.event_type)) emailsOpened++;
      if (['EMAIL_REPLIED', 'REPLIED'].includes(e.event_type)) emailsReplied++;
    } else if (e.channel === 'linkedin') {
      totalLinkedIn++;
      if (e.event_type === 'CONNECTION_REQUEST_ACCEPTED') linkedInConnected++;
      if (['MESSAGE_RECEIVED', 'INMAIL_RECEIVED', 'LEAD_REPLIED'].includes(e.event_type)) linkedInReplied++;
    } else {
      totalCalls++;
      if (e.event_type === 'call_completed') callsConnected++;
    }
  }

  return {
    totalEmails,
    totalCalls,
    totalLinkedIn,
    emailsOpened,
    emailsReplied,
    callsConnected,
    linkedInConnected,
    linkedInReplied,
    lastTouch: entries.length > 0 ? entries[0].timestamp : null,
  };
}

// ── Individual timeline entry ──

function TimelineEntry({ entry }: { entry: UnifiedActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isEmail = entry.channel === 'email';
  const isLinkedIn = entry.channel === 'linkedin';
  const isCall = entry.channel === 'call';

  const iconConfig = isLinkedIn
    ? LINKEDIN_ICON_MAP[entry.event_type] || { icon: Linkedin, color: 'text-blue-700 bg-blue-50' }
    : isEmail
      ? EMAIL_ICON_MAP[entry.event_type] || { icon: Mail, color: 'text-muted-foreground bg-muted' }
      : getCallIcon(entry.event_type, entry.details.call_outcome || null);

  const Icon = iconConfig.icon;

  const hasExpandableContent = isCall && (entry.details.call_transcript || entry.details.contact_notes);

  return (
    <div className="flex items-start gap-3 py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${iconConfig.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{entry.label}</span>
          <Badge variant="outline" className={`text-[10px] ${isLinkedIn ? 'border-blue-300 text-blue-800' : isEmail ? 'border-blue-200 text-blue-700' : 'border-green-200 text-green-700'}`}>
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
              {entry.details.talk_time_seconds ? ` (talk: ${formatDuration(entry.details.talk_time_seconds)})` : ''}
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
        {entry.context && (
          <p className="text-xs text-muted-foreground">{entry.context}</p>
        )}
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
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
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
          <span>
            {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
          </span>
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
}

export function ContactActivityTimeline({
  buyerId,
  title = 'Contact Activity Timeline',
  maxHeight = 500,
  compact = false,
}: ContactActivityTimelineProps) {
  const { data: entries = [], isLoading } = useContactCombinedHistory(buyerId);
  return (
    <TimelineCard
      entries={entries}
      isLoading={isLoading}
      title={title}
      maxHeight={maxHeight}
      compact={compact}
    />
  );
}

// ── Variant: by email ──

interface ContactActivityTimelineByEmailProps {
  email: string;
  title?: string;
  maxHeight?: number;
  compact?: boolean;
}

export function ContactActivityTimelineByEmail({
  email,
  title = 'Contact Activity Timeline',
  maxHeight = 500,
  compact = false,
}: ContactActivityTimelineByEmailProps) {
  const { data: entries = [], isLoading } = useContactCombinedHistoryByEmail(email);
  return (
    <TimelineCard
      entries={entries}
      isLoading={isLoading}
      title={title}
      maxHeight={maxHeight}
      compact={compact}
    />
  );
}

// ── Shared card renderer ──

function TimelineCard({
  entries,
  isLoading,
  title,
  maxHeight,
  compact,
}: {
  entries: UnifiedActivityEntry[];
  isLoading: boolean;
  title: string;
  maxHeight: number;
  compact: boolean;
}) {
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

  const stats = computeStats(entries);

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
              Email, call, and LinkedIn history from SmartLead, PhoneBurner, and HeyReach will appear here
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
            {stats.totalEmails > 0 && (
              <Badge variant="outline" className="text-xs border-blue-200 text-blue-700">
                <Mail className="h-3 w-3 mr-1" />
                {stats.totalEmails} email{stats.totalEmails !== 1 ? 's' : ''}
              </Badge>
            )}
            {stats.totalCalls > 0 && (
              <Badge variant="outline" className="text-xs border-green-200 text-green-700">
                <Phone className="h-3 w-3 mr-1" />
                {stats.totalCalls} call{stats.totalCalls !== 1 ? 's' : ''}
              </Badge>
            )}
            {stats.totalLinkedIn > 0 && (
              <Badge variant="outline" className="text-xs border-blue-300 text-blue-800">
                <Linkedin className="h-3 w-3 mr-1" />
                {stats.totalLinkedIn} LinkedIn
              </Badge>
            )}
          </div>
        </div>
        {/* Summary stats row (HubSpot-style) */}
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
            {stats.lastTouch && (
              <span className="ml-auto">
                Last touch: {formatDistanceToNow(new Date(stats.lastTouch), { addSuffix: true })}
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
          {entries.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
