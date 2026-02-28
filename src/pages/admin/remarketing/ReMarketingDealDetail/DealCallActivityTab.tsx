import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, PhoneCall, Clock, Mic, FileText, ChevronDown } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useDealCallActivities, type DealCallActivity } from "@/hooks/use-deal-call-activities";

interface DealCallActivityTabProps {
  listingId: string;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function CallEntry({ activity }: { activity: DealCallActivity }) {
  const [expanded, setExpanded] = useState(false);
  const hasExpandable = activity.call_transcript || activity.contact_notes;
  const isCompleted = activity.activity_type === 'call_completed';

  return (
    <div className="flex items-start gap-3 py-3 px-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${
        activity.call_connected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        {activity.call_connected ? <PhoneCall className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            {isCompleted ? 'Call Completed' : 'Call Attempt'}
          </span>
          {(activity.disposition_label || activity.phoneburner_status) && (
            <Badge variant="secondary" className="text-[10px]">
              {activity.disposition_label || activity.phoneburner_status}
            </Badge>
          )}
          {activity.call_connected && (
            <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700">
              Connected
            </Badge>
          )}
          {activity.call_duration_seconds ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(activity.call_duration_seconds)}
              {activity.talk_time_seconds ? ` (talk: ${formatDuration(activity.talk_time_seconds)})` : ''}
            </span>
          ) : null}
          {(activity.recording_url || activity.recording_url_public) && (
            <a
              href={activity.recording_url_public || activity.recording_url || ''}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Mic className="h-3 w-3" />
              Recording
            </a>
          )}
          {activity.call_transcript && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Transcript
            </span>
          )}
        </div>

        {activity.disposition_notes && (
          <p className="text-xs text-muted-foreground italic line-clamp-2">{activity.disposition_notes}</p>
        )}

        {hasExpandable && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Hide details' : 'Show transcript & notes'}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {activity.call_transcript && (
                <div className="rounded-md bg-muted/50 p-3 text-xs text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                  <p className="font-medium text-muted-foreground mb-1">Transcript</p>
                  {activity.call_transcript}
                </div>
              )}
              {activity.contact_notes && (
                <div className="rounded-md bg-muted/50 p-3 text-xs text-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                  <p className="font-medium text-muted-foreground mb-1">Contact Notes</p>
                  {activity.contact_notes}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {activity.user_name && <span>by {activity.user_name}</span>}
          {activity.contact_email && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>{activity.contact_email}</span>
            </>
          )}
          {activity.call_started_at && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>{format(new Date(activity.call_started_at), 'MMM d, yyyy h:mm a')}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{formatDistanceToNow(new Date(activity.call_started_at), { addSuffix: true })}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DealCallActivityTab({ listingId }: DealCallActivityTabProps) {
  const { data: activities = [], isLoading } = useDealCallActivities(listingId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            PhoneBurner Call Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Compute quick stats
  const totalCalls = activities.filter(a => a.activity_type === 'call_completed' || a.activity_type === 'call_attempt').length;
  const connected = activities.filter(a => a.call_connected).length;
  const totalTalkTime = activities.reduce((sum, a) => sum + (a.talk_time_seconds || a.call_duration_seconds || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            PhoneBurner Call Activity
          </CardTitle>
          {totalCalls > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {totalCalls} calls
              </span>
              <span className="flex items-center gap-1">
                <PhoneCall className="h-3 w-3" /> {connected} connected
              </span>
              {totalTalkTime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDuration(totalTalkTime)} talk time
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No PhoneBurner calls recorded for this deal</p>
            <p className="text-xs mt-1">Push contacts to PhoneBurner and start dialing to see activity here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity) => (
              <CallEntry key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
