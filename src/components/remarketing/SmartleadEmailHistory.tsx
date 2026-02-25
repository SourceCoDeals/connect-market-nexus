import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Megaphone,
} from 'lucide-react';
import { useContactSmartleadHistory } from '@/hooks/smartlead';
import type { SmartleadContactActivity, SmartleadContactEvent } from '@/hooks/smartlead';

interface SmartleadEmailHistoryProps {
  buyerId: string;
}

const eventConfig: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  EMAIL_SENT: { label: 'Sent', icon: Mail, color: 'text-blue-600' },
  EMAIL_OPENED: { label: 'Opened', icon: MailOpen, color: 'text-emerald-600' },
  OPENED: { label: 'Opened', icon: MailOpen, color: 'text-emerald-600' },
  LINK_CLICKED: {
    label: 'Clicked',
    icon: MousePointerClick,
    color: 'text-violet-600',
  },
  CLICKED: {
    label: 'Clicked',
    icon: MousePointerClick,
    color: 'text-violet-600',
  },
  EMAIL_REPLIED: { label: 'Replied', icon: Reply, color: 'text-primary' },
  REPLIED: { label: 'Replied', icon: Reply, color: 'text-primary' },
  EMAIL_BOUNCED: {
    label: 'Bounced',
    icon: AlertTriangle,
    color: 'text-destructive',
  },
  BOUNCED: {
    label: 'Bounced',
    icon: AlertTriangle,
    color: 'text-destructive',
  },
  UNSUBSCRIBED: { label: 'Unsubscribed', icon: Ban, color: 'text-amber-600' },
  INTERESTED: {
    label: 'Interested',
    icon: ThumbsUp,
    color: 'text-emerald-600',
  },
  NOT_INTERESTED: {
    label: 'Not Interested',
    icon: ThumbsDown,
    color: 'text-muted-foreground',
  },
  MANUAL_STEP_REACHED: {
    label: 'Manual Step',
    icon: Clock,
    color: 'text-amber-600',
  },
};

function getEventConfig(eventType: string) {
  return (
    eventConfig[eventType] || {
      label: eventType.replace(/_/g, ' '),
      icon: Mail,
      color: 'text-muted-foreground',
    }
  );
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'COMPLETED':
    case 'replied':
      return 'default';
    case 'ACTIVE':
    case 'sent':
      return 'secondary';
    case 'bounced':
    case 'STOPPED':
      return 'destructive';
    default:
      return 'outline';
  }
}

function CampaignCard({ campaign }: { campaign: SmartleadContactActivity }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-md bg-muted/50">
      <div className="flex items-center gap-3">
        <Megaphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">{campaign.campaign_name || 'Campaign'}</p>
          <p className="text-xs text-muted-foreground">{campaign.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={statusBadgeVariant(campaign.lead_status || 'unknown')}>{campaign.lead_status || 'unknown'}</Badge>
        {campaign.lead_category && (
          <Badge variant="outline" className="text-xs">
            {campaign.lead_category}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : '—'}
        </span>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: SmartleadContactEvent }) {
  const config = getEventConfig(event.event_type);
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <div
        className={`flex items-center justify-center h-7 w-7 rounded-full bg-muted ${config.color}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{config.label}</span>
          {event.campaign_name && (
            <span className="text-xs text-muted-foreground truncate">{event.campaign_name}</span>
          )}
        </div>
        {event.lead_email && <p className="text-xs text-muted-foreground">{event.lead_email}</p>}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {event.created_at ? new Date(event.created_at).toLocaleDateString() : '—'}{' '}
        {event.created_at ? new Date(event.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }) : ''}
      </span>
    </div>
  );
}

export function SmartleadEmailHistory({ buyerId }: SmartleadEmailHistoryProps) {
  const { data, isLoading } = useContactSmartleadHistory(buyerId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Smartlead Email History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const campaigns = data?.campaigns || [];
  const events = data?.events || [];

  if (campaigns.length === 0 && events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Smartlead Email History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            No Smartlead email activity for this buyer yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Smartlead Email History
          </CardTitle>
          <div className="flex items-center gap-2">
            {campaigns.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {events.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {events.length} event{events.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Campaign Participation */}
        {campaigns.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Campaign Participation
            </p>
            <div className="space-y-1.5">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          </div>
        )}

        {/* Email Event Timeline */}
        {events.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email Activity Timeline
            </p>
            <div className="divide-y divide-border">
              {events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
