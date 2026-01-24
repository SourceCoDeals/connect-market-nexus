import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Mail, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Zap,
  MailOpen,
  MousePointerClick,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface EmailStep {
  id: string;
  name: string;
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced';
  sentAt?: string;
  openedAt?: string;
  clickedAt?: string;
}

interface OutreachSequence {
  id: string;
  buyerName: string;
  buyerCompany: string;
  contactEmail: string;
  sequenceName: string;
  startedAt: string;
  status: 'active' | 'completed' | 'paused' | 'failed';
  currentStep: number;
  totalSteps: number;
  steps: EmailStep[];
  nextScheduledAt?: string;
}

interface OutreachSequenceTrackerProps {
  sequences: OutreachSequence[];
  onPauseSequence?: (sequenceId: string) => void;
  onResumeSequence?: (sequenceId: string) => void;
  className?: string;
}

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700 border-green-200' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 border-red-200' },
};

const STEP_STATUS_ICONS = {
  pending: Clock,
  sent: Mail,
  opened: MailOpen,
  clicked: MousePointerClick,
  replied: CheckCircle2,
  bounced: XCircle,
};

export const OutreachSequenceTracker = ({
  sequences,
  onPauseSequence,
  onResumeSequence,
  className
}: OutreachSequenceTrackerProps) => {
  // Calculate aggregate stats
  const stats = {
    total: sequences.length,
    active: sequences.filter(s => s.status === 'active').length,
    completed: sequences.filter(s => s.status === 'completed').length,
    avgProgress: sequences.length > 0
      ? Math.round(sequences.reduce((sum, s) => sum + (s.currentStep / s.totalSteps) * 100, 0) / sequences.length)
      : 0,
    totalOpens: sequences.reduce((sum, s) => 
      sum + s.steps.filter(step => step.status === 'opened' || step.status === 'clicked' || step.status === 'replied').length, 0
    ),
    totalReplies: sequences.reduce((sum, s) => 
      sum + s.steps.filter(step => step.status === 'replied').length, 0
    ),
  };

  const openRate = stats.total > 0 ? Math.round((stats.totalOpens / stats.total) * 100) : 0;
  const replyRate = stats.total > 0 ? Math.round((stats.totalReplies / stats.total) * 100) : 0;

  if (sequences.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Email Sequences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No active sequences</p>
            <p className="text-sm">Start a sequence from the Outreach panel</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Email Sequences
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              {stats.active} active
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.avgProgress}%</p>
            <p className="text-xs text-muted-foreground">Avg Progress</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{openRate}%</p>
            <p className="text-xs text-muted-foreground">Open Rate</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{replyRate}%</p>
            <p className="text-xs text-muted-foreground">Reply Rate</p>
          </div>
        </div>

        {/* Sequence List */}
        <div className="space-y-3">
          {sequences.slice(0, 5).map(sequence => {
            const progress = (sequence.currentStep / sequence.totalSteps) * 100;
            const statusConfig = STATUS_CONFIG[sequence.status];
            
            return (
              <div 
                key={sequence.id}
                className="p-3 border rounded-lg space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{sequence.buyerCompany}</p>
                    <p className="text-sm text-muted-foreground">{sequence.contactEmail}</p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", statusConfig.color)}
                  >
                    {statusConfig.label}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <Progress value={progress} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {sequence.currentStep}/{sequence.totalSteps}
                  </span>
                </div>
                
                {/* Step indicators */}
                <div className="flex items-center gap-1">
                  {sequence.steps.map((step, index) => {
                    const Icon = STEP_STATUS_ICONS[step.status];
                    return (
                      <React.Fragment key={step.id}>
                        <div 
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center",
                            step.status === 'pending' && "bg-muted text-muted-foreground",
                            step.status === 'sent' && "bg-blue-100 text-blue-600",
                            step.status === 'opened' && "bg-amber-100 text-amber-600",
                            step.status === 'clicked' && "bg-purple-100 text-purple-600",
                            step.status === 'replied' && "bg-green-100 text-green-600",
                            step.status === 'bounced' && "bg-red-100 text-red-600"
                          )}
                          title={`${step.name}: ${step.status}`}
                        >
                          <Icon className="h-3 w-3" />
                        </div>
                        {index < sequence.steps.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Started {formatDistanceToNow(new Date(sequence.startedAt), { addSuffix: true })}</span>
                  {sequence.nextScheduledAt && sequence.status === 'active' && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Next: {formatDistanceToNow(new Date(sequence.nextScheduledAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
                
                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  {sequence.status === 'active' && onPauseSequence && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onPauseSequence(sequence.id)}
                    >
                      Pause
                    </Button>
                  )}
                  {sequence.status === 'paused' && onResumeSequence && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onResumeSequence(sequence.id)}
                    >
                      Resume
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {sequences.length > 5 && (
          <Button variant="ghost" className="w-full text-sm">
            View all {sequences.length} sequences
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default OutreachSequenceTracker;
