/**
 * ContactTimeline.tsx
 *
 * Timeline rendering sub-components for ContactHistoryTracker: engagement badges,
 * stat cards, channel sections, and individual entry renderers (email, call, LinkedIn).
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  Phone,
  Linkedin,
  ChevronDown,
  CheckCircle,
  Clock,
  Mic,
  User,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { type UnifiedActivityEntry } from '@/hooks/use-contact-combined-history';
import {
  ContactActivityTimeline,
  ContactActivityTimelineByEmail,
} from '@/components/remarketing/ContactActivityTimeline';
import { formatDuration, type ContactTab } from './useContactHistory';

// ── EngagementBadge ──

export function EngagementBadge({ status }: { status: 'active' | 'warm' | 'cold' | 'none' }) {
  if (status === 'none') return null;

  const config = {
    active: {
      classes:
        'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400',
      dot: 'bg-emerald-500',
      label: 'Actively Engaged',
    },
    warm: {
      classes:
        'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400',
      dot: 'bg-amber-500',
      label: 'Warm Lead',
    },
    cold: {
      classes: 'bg-muted border-border text-muted-foreground',
      dot: 'bg-muted-foreground',
      label: 'Gone Cold',
    },
  }[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${config.classes}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
      {config.label}
    </div>
  );
}

// ── NextActionIcon ──

export function NextActionIcon({ type }: { type: 'mail' | 'phone' | 'linkedin' }) {
  const className = 'w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5';
  if (type === 'phone') return <Phone className={className} />;
  if (type === 'linkedin') return <Linkedin className={className} />;
  return <Mail className={className} />;
}

// ── StatCard ──

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Mail;
  color: 'blue' | 'green' | 'violet';
}) {
  const iconColor = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    violet: 'text-violet-500',
  }[color];

  return (
    <div className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
          {label}
        </span>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ── ChannelSection ──

export function ChannelSection({
  icon: Icon,
  title,
  count,
  color,
  expanded,
  onToggle,
  children,
}: {
  icon: typeof Mail;
  title: string;
  count: number;
  color: 'blue' | 'green' | 'violet';
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const colorStyles = {
    blue: {
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
    },
    green: {
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-500 bg-green-50 dark:bg-green-950/30',
    },
    violet: {
      border: 'border-violet-200 dark:border-violet-800',
      icon: 'text-violet-500 bg-violet-50 dark:bg-violet-950/30',
    },
  }[color];

  return (
    <div className={`rounded-lg border ${colorStyles.border} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${colorStyles.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {count} {count === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && <div className="border-t px-4 pb-4 pt-2 space-y-2">{children}</div>}
    </div>
  );
}

// ── Entry Renderers ──

export function EmailEntry({ entry }: { entry: UnifiedActivityEntry }) {
  const isOpened = ['EMAIL_OPENED', 'OPENED'].includes(entry.event_type);
  const isReplied = ['EMAIL_REPLIED', 'REPLIED'].includes(entry.event_type);
  const isSent = entry.event_type === 'EMAIL_SENT';

  return (
    <div className="rounded-md border bg-card p-3 hover:bg-muted/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-sm">{entry.label}</h4>
          {entry.context && <p className="text-xs text-muted-foreground mt-0.5">{entry.context}</p>}
          {entry.details.lead_email && (
            <p className="text-xs text-muted-foreground mt-0.5">{entry.details.lead_email}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
          {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted">
          {isOpened || isReplied ? (
            <>
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>{isReplied ? 'Replied' : 'Opened'}</span>
            </>
          ) : isSent ? (
            <>
              <Mail className="w-3 h-3 text-blue-500" />
              <span>Sent</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>{entry.label}</span>
            </>
          )}
        </div>
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
        </span>
      </div>
      {isReplied && entry.details.lead_email && (
        <div className="mt-2 p-2 rounded-md bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800">
          <div className="text-xs text-muted-foreground">
            Reply received from {entry.details.lead_email}
          </div>
        </div>
      )}
    </div>
  );
}

export function CallEntry({ entry }: { entry: UnifiedActivityEntry }) {
  const isConnected =
    entry.event_type === 'call_completed' && entry.details.call_outcome === 'dispositioned';
  const isVoicemail =
    entry.details.call_outcome === 'no_answer' ||
    entry.details.disposition_code?.toLowerCase().includes('voicemail');

  return (
    <div className="rounded-md border bg-card p-3 hover:bg-muted/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{entry.label}</span>
            <Badge
              variant={isConnected ? 'default' : isVoicemail ? 'secondary' : 'outline'}
              className="text-[10px]"
            >
              {isConnected
                ? 'Connected'
                : isVoicemail
                  ? 'Voicemail'
                  : entry.details.call_outcome || ''}
            </Badge>
          </div>
          {entry.context && <p className="text-xs text-muted-foreground mt-0.5">{entry.context}</p>}
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
        </span>
      </div>
      {entry.details.call_duration_seconds && entry.details.call_duration_seconds > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          Duration:{' '}
          <span className="font-semibold">
            {formatDuration(entry.details.call_duration_seconds)}
          </span>
        </div>
      )}
      {entry.details.disposition_label && (
        <Badge variant="secondary" className="text-[10px] mb-2">
          {entry.details.disposition_label}
        </Badge>
      )}
      {entry.details.disposition_notes && (
        <div className="p-2 rounded-md bg-muted text-sm">
          <div className="text-xs text-muted-foreground mb-0.5">Notes:</div>
          {entry.details.disposition_notes}
        </div>
      )}
      {entry.details.recording_url && (
        <a
          href={entry.details.recording_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
        >
          <Mic className="w-3 h-3" />
          Listen to Recording
        </a>
      )}
    </div>
  );
}

export function LinkedInEntry({ entry }: { entry: UnifiedActivityEntry }) {
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
    <div className="rounded-md border bg-card p-3 hover:bg-muted/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium text-sm">{typeLabel}</span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
        </span>
      </div>
      {entry.context && <p className="text-xs text-muted-foreground mb-1">{entry.context}</p>}
      {entry.details.lead_linkedin_url && (
        <p className="text-xs text-muted-foreground mb-1 truncate">
          {entry.details.lead_linkedin_url}
        </p>
      )}
      {(isReply || isAccepted) && (
        <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800">
          <div className="text-xs text-muted-foreground">
            {isAccepted ? 'Connection accepted' : 'Response received'}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Per-contact timeline ──

export function SingleContactTimeline({
  tab,
}: {
  tab: ContactTab;
}) {
  if (tab.buyerId) {
    return (
      <ContactActivityTimeline
        buyerId={tab.buyerId}
        title={`${tab.label} - Activity`}
        maxHeight={600}
        compact
      />
    );
  }

  if (tab.email) {
    return (
      <ContactActivityTimelineByEmail
        email={tab.email}
        title={`${tab.label} - Activity`}
        maxHeight={600}
        compact
      />
    );
  }

  return (
    <div className="text-center py-6 text-muted-foreground text-sm">
      <Phone className="h-6 w-6 mx-auto mb-2 opacity-40" />
      No email address on file — cannot look up communication history
    </div>
  );
}

// ── ContactTabSelector ──

export function ContactTabSelector({
  tabs,
  activeTabId,
  onSelect,
}: {
  tabs: ContactTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTabId === tab.id
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
  );
}

// ── ActiveContactHeader ──

export function ActiveContactHeader({ tab }: { tab: ContactTab }) {
  return (
    <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50">
      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{tab.label}</p>
        {tab.email && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            {tab.email}
          </div>
        )}
      </div>
    </div>
  );
}
