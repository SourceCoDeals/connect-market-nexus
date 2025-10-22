import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, XCircle, UserCircle } from "lucide-react";

interface ProcessStep {
  id: string;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
}

interface DealProcessStepsProps {
  requestStatus: 'pending' | 'approved' | 'rejected';
  className?: string;
}

export function DealProcessSteps({ requestStatus, className }: DealProcessStepsProps) {
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
            description: "We're presenting your firm to the business owner",
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
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <div className={cn("space-y-8", className)}>
      {/* Status Message - Minimal Card */}
      <div className="border-l-2 border-slate-900 pl-4 py-1">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          {statusInfo.title}
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          {statusInfo.message}
        </p>
        {statusInfo.action && (
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 text-sm text-slate-900 hover:text-slate-600 transition-colors mt-2 group"
          >
            Update your buyer profile
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>

      {/* Progress Steps - Minimal Design */}
      <div className="space-y-6" role="list" aria-label="Request progress">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="relative flex gap-4" role="listitem">
              {/* Connector Line */}
              {!isLast && (
                <div 
                  className={cn(
                    "absolute left-[11px] top-7 w-px h-[calc(100%+1.5rem)]",
                    step.status === 'completed' ? "bg-slate-900" : "bg-slate-200"
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step Indicator */}
              <div className={cn(
                "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors mt-0.5",
                step.status === 'completed' && step.id !== 'declined' && "bg-slate-900",
                step.status === 'completed' && step.id === 'declined' && "bg-slate-400",
                step.status === 'active' && "border-2 border-slate-900 bg-white",
                step.status === 'pending' && "border-2 border-slate-200 bg-white"
              )}>
                {step.status === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                )}
                {step.status === 'active' && (
                  <div className="w-2 h-2 rounded-full bg-slate-900" />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 pb-2">
                <h4 className={cn(
                  "text-sm font-medium mb-0.5",
                  step.status === 'completed' && "text-slate-900",
                  step.status === 'active' && "text-slate-900",
                  step.status === 'pending' && "text-slate-400"
                )}>
                  {step.label}
                </h4>
                <p className={cn(
                  "text-sm leading-relaxed",
                  step.status === 'completed' && "text-slate-600",
                  step.status === 'active' && "text-slate-600",
                  step.status === 'pending' && "text-slate-400"
                )}>
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
