import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, XCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DealReviewPanel } from "./DealReviewPanel";

interface ProcessStep {
  id: string;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
}

interface DealProcessStepsProps {
  requestStatus: 'pending' | 'approved' | 'rejected';
  className?: string;
  requestId?: string;
  userMessage?: string | null;
  onMessageUpdate?: (message: string) => Promise<void>;
  isProfileComplete?: boolean;
  profileCompletionPercentage?: number;
}

export function DealProcessSteps({ 
  requestStatus, 
  className,
  requestId,
  userMessage,
  onMessageUpdate,
  isProfileComplete = false,
  profileCompletionPercentage = 0,
}: DealProcessStepsProps) {
  const getSteps = (): ProcessStep[] => {
    switch (requestStatus) {
      case 'pending':
        return [
          {
            id: 'submitted',
            label: 'Submitted',
            description: 'Request received',
            status: 'completed'
          },
          {
            id: 'review',
            label: 'Under Review',
            description: "Our team is reviewing your buyer profile and presenting your firm to the business owner. They're evaluating your qualifications and investment approach.",
            status: 'active'
          },
          {
            id: 'decision',
            label: 'Decision',
            description: 'Awaiting owner decision',
            status: 'pending'
          }
        ];
      case 'approved':
        return [
          {
            id: 'submitted',
            label: 'Submitted',
            description: 'Request received',
            status: 'completed'
          },
          {
            id: 'review',
            label: 'Under Review',
            description: 'Profile and criteria reviewed',
            status: 'completed'
          },
          {
            id: 'approved',
            label: 'Approved',
            description: 'Request approved successfully',
            status: 'completed'
          }
        ];
      case 'rejected':
        return [
          {
            id: 'submitted',
            label: 'Submitted',
            description: 'Request received',
            status: 'completed'
          },
          {
            id: 'review',
            label: 'Under Review',
            description: 'Owner reviewed your profile',
            status: 'completed'
          },
          {
            id: 'declined',
            label: 'Declined',
            description: 'Owner declined at this time',
            status: 'completed'
          }
        ];
      default:
        // Fallback for undefined or invalid status
        return [
          {
            id: 'submitted',
            label: 'Submitted',
            description: 'Request received',
            status: 'completed'
          },
          {
            id: 'review',
            label: 'Under Review',
            description: 'Processing your request',
            status: 'active'
          }
        ];
    }
  };

  const steps = getSteps();

  const getStepIcon = (status: ProcessStep['status'], stepId: string) => {
    if (status === 'completed') {
      if (stepId === 'declined') {
        return <XCircle className="w-5 h-5" />;
      }
      return <CheckCircle2 className="w-5 h-5" />;
    }
    if (status === 'active') {
      return <Clock className="w-5 h-5" />;
    }
    return <div className="w-2 h-2 rounded-full bg-slate-300" />;
  };

  const getStatusMessage = () => {
    switch (requestStatus) {
      case 'pending':
        return {
          title: 'Under Review',
          message: "Our team is reviewing your buyer profile and presenting your firm to the business owner. They're evaluating your qualifications and investment approach.",
          action: true
        };
      case 'approved':
        return {
          title: 'Request Approved',
          message: "We've reviewed your request and connection criteria. Our team will be in touch with next steps shortly.",
          action: false
        };
      case 'rejected':
        return {
          title: 'Request Declined',
          message: 'The business owner declined the connection at this time. Continue exploring other opportunities that match your criteria.',
          action: false
        };
      default:
        return {
          title: 'Processing',
          message: 'Your request is being processed.',
          action: false
        };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <TooltipProvider>
      <div className={cn("space-y-8", className)}>
        {/* Progress Steps - Minimal Design */}
        <div className="space-y-4" role="list" aria-label="Request progress">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            
            return (
              <div key={step.id} className="relative flex gap-3.5" role="listitem">
                {/* Connector Line */}
                {!isLast && (
                  <div 
                    className={cn(
                      "absolute left-[9px] top-6 w-px h-[calc(100%+1rem)]",
                      step.status === 'completed' ? "bg-slate-900" : "bg-slate-200"
                    )}
                    aria-hidden="true"
                  />
                )}

                {/* Step Indicator */}
                <div className={cn(
                  "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                  step.status === 'completed' && step.id !== 'declined' && "bg-slate-900",
                  step.status === 'completed' && step.id === 'declined' && "bg-slate-400",
                  step.status === 'active' && "border-2 border-slate-900 bg-white",
                  step.status === 'pending' && "border border-slate-300 bg-white"
                )}>
                  {step.status === 'completed' && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                  {step.status === 'active' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 pb-1 pt-px">
                  <div className="flex items-center gap-2">
                    <h4 className={cn(
                      "text-sm font-medium",
                      step.status === 'completed' && "text-slate-900",
                      step.status === 'active' && "text-slate-900",
                      step.status === 'pending' && "text-slate-400"
                    )}>
                      {step.label}
                    </h4>
                    
                    {/* Tooltip for Under Review */}
                    {step.id === 'review' && (
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center hover:bg-slate-100 rounded-full p-0.5 transition-colors">
                            <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent 
                          side="right" 
                          className="max-w-sm bg-slate-900 text-white border-slate-800 p-4"
                          sideOffset={8}
                        >
                          <div className="space-y-2.5 text-xs leading-relaxed">
                            <p className="font-medium text-white">How our process works</p>
                            <p className="text-slate-200">
                              Once we understand each buyer&apos;s strategy, we present only the options that best align with the seller&apos;s goals. Ultimately, the business owner decides which buyer they&apos;d like to engage with.
                            </p>
                            <p className="text-slate-200">
                              We typically introduce one buyer at a time. This is intentional because it protects the seller&apos;s time and ensures that when we are compensated by the buyer, the process remains collaborative rather than auction driven.
                            </p>
                            <p className="text-slate-200">
                              Because of this approach, we can&apos;t guarantee that a seller will elect to engage with a specific buyer. However, we&apos;re always transparent about our process with both sides and prioritize efficiency and respect for everyone&apos;s time.
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  
                  <p className={cn(
                    "text-sm leading-relaxed mt-0.5",
                    step.status === 'completed' && "text-slate-600",
                    step.status === 'active' && "text-slate-600",
                    step.status === 'pending' && "text-slate-400"
                  )}>
                    {step.description}
                  </p>

                  {/* Inline Review Panel for Active Under Review Step */}
                  {step.id === 'review' && 
                   step.status === 'active' && 
                   requestStatus === 'pending' &&
                   requestId &&
                   onMessageUpdate && (
                    <DealReviewPanel
                      requestId={requestId}
                      userMessage={userMessage}
                      onMessageUpdate={onMessageUpdate}
                      isProfileComplete={isProfileComplete}
                      profileCompletionPercentage={profileCompletionPercentage}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
