import { CheckCircle2, Clock, Send, FileText, Shield, MessageSquare } from "lucide-react";
import { User } from "@/types";

interface WorkflowProgressIndicatorProps {
  user: User;
  followedUp?: boolean;
}

export function WorkflowProgressIndicator({ user, followedUp = false }: WorkflowProgressIndicatorProps) {
  const steps = [
    {
      id: 'nda-sent',
      label: 'NDA Sent',
      icon: Send,
      completed: user.nda_email_sent || user.nda_signed || false,
      signed: user.nda_signed || false
    },
    {
      id: 'nda-signed',
      label: 'NDA Signed',
      icon: Shield,
      completed: user.nda_signed || false,
      signed: false
    },
    {
      id: 'fee-sent',
      label: 'Fee Sent',
      icon: Send,
      completed: user.fee_agreement_email_sent || user.fee_agreement_signed || false,
      signed: user.fee_agreement_signed || false
    },
    {
      id: 'fee-signed',
      label: 'Fee Signed',
      icon: FileText,
      completed: user.fee_agreement_signed || false,
      signed: false
    },
    {
      id: 'follow-up',
      label: 'Follow-up',
      icon: MessageSquare,
      completed: followedUp,
      signed: false
    }
  ];

  const getStepColor = (step: typeof steps[0], index: number) => {
    if (step.completed || step.signed) {
      return 'text-success bg-success/10 border-success/20';
    }
    
    // Check if previous steps are complete to determine if this step is "active"
    const previousStepsComplete = steps.slice(0, index).every(s => s.completed);
    if (previousStepsComplete) {
      return 'text-info bg-info/10 border-info/20';
    }
    
    return 'text-muted-foreground bg-muted/50 border-border';
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-card/50 rounded-lg border border-border/50">
      <div className="flex items-center space-x-1">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`
                  flex items-center justify-center w-6 h-6 rounded-full border transition-all
                  ${getStepColor(step, index)}
                `}
                title={step.label}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <StepIcon className="h-3 w-3" />
                )}
              </div>
              
              {!isLast && (
                <div 
                  className={`
                    w-4 h-0.5 mx-1 transition-all
                    ${step.completed ? 'bg-success/30' : 'bg-border/50'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="ml-2 text-xs text-muted-foreground">
        {steps.filter(s => s.completed).length}/{steps.length} complete
      </div>
    </div>
  );
}