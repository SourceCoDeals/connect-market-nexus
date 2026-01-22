import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Phone,
  FileText,
  FileCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface OutreachRecord {
  contacted_at?: string | null;
  contacted_by?: string | null;
  nda_sent_at?: string | null;
  nda_signed_at?: string | null;
  cim_sent_at?: string | null;
  meeting_scheduled_at?: string | null;
  outcome?: string | null;
  outcome_notes?: string | null;
}

interface OutreachTimelineProps {
  outreach: OutreachRecord | null;
  className?: string;
}

const timelineSteps = [
  { key: 'contacted_at', label: 'Contacted', icon: Phone, color: 'text-blue-500' },
  { key: 'nda_sent_at', label: 'NDA Sent', icon: FileText, color: 'text-purple-500' },
  { key: 'nda_signed_at', label: 'NDA Signed', icon: FileCheck, color: 'text-indigo-500' },
  { key: 'cim_sent_at', label: 'CIM Sent', icon: FileText, color: 'text-teal-500' },
  { key: 'meeting_scheduled_at', label: 'Meeting', icon: Calendar, color: 'text-amber-500' },
] as const;

const outcomeConfig = {
  'won': { label: 'Won', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50' },
  'lost': { label: 'Lost', icon: XCircle, color: 'text-red-500 bg-red-50' },
  'withdrawn': { label: 'Withdrawn', icon: XCircle, color: 'text-amber-500 bg-amber-50' },
  'no_response': { label: 'No Response', icon: Clock, color: 'text-muted-foreground bg-muted' },
  'in_progress': { label: 'In Progress', icon: Clock, color: 'text-blue-500 bg-blue-50' },
};

export const OutreachTimeline = ({ outreach, className }: OutreachTimelineProps) => {
  if (!outreach) {
    return (
      <div className={cn("text-center py-4 text-muted-foreground text-sm", className)}>
        No outreach activity yet
      </div>
    );
  }

  // Find the furthest step completed
  const completedSteps = timelineSteps.filter(step => outreach[step.key]);
  
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        {timelineSteps.map((step, index) => {
          const isCompleted = !!outreach[step.key];
          const timestamp = outreach[step.key];
          const Icon = step.icon;
          
          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                    isCompleted
                      ? `${step.color} border-current bg-current/10`
                      : "border-muted-foreground/30 text-muted-foreground/30"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className={cn(
                  "text-xs mt-1 text-center whitespace-nowrap",
                  isCompleted ? "text-foreground" : "text-muted-foreground/50"
                )}>
                  {step.label}
                </span>
                {timestamp && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(timestamp), 'M/d')}
                  </span>
                )}
              </div>
              
              {index < timelineSteps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 mx-1",
                    isCompleted && outreach[timelineSteps[index + 1]?.key]
                      ? "bg-primary"
                      : isCompleted
                      ? "bg-primary/30"
                      : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Outcome */}
      {outreach.outcome && outcomeConfig[outreach.outcome as keyof typeof outcomeConfig] && (
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Outcome:</span>
            {(() => {
              const config = outcomeConfig[outreach.outcome as keyof typeof outcomeConfig];
              const Icon = config.icon;
              return (
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", config.color)}>
                  <Icon className="h-3 w-3" />
                  {config.label}
                </span>
              );
            })()}
          </div>
          {outreach.outcome_notes && (
            <p className="text-xs text-muted-foreground mt-1">{outreach.outcome_notes}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default OutreachTimeline;
