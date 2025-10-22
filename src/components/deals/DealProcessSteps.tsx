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
            description: 'Owner reviewed your profile',
            status: 'completed'
          },
          {
            id: 'approved',
            label: 'Approved',
            description: 'Owner approved connection',
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
          title: 'Connection Approved',
          message: "The business owner approved your connection request. You'll receive introduction details and next steps shortly.",
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
    <div className={cn("space-y-6", className)}>
      {/* Status Message Card */}
      <div className={cn(
        "rounded-lg border p-5 transition-colors",
        requestStatus === 'pending' && "bg-slate-50 border-slate-200",
        requestStatus === 'approved' && "bg-slate-50 border-slate-300",
        requestStatus === 'rejected' && "bg-slate-50 border-slate-200"
      )}>
        <div className="flex items-start gap-3">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            requestStatus === 'pending' && "bg-slate-100 text-slate-700",
            requestStatus === 'approved' && "bg-slate-200 text-slate-800",
            requestStatus === 'rejected' && "bg-slate-100 text-slate-600"
          )}>
            {requestStatus === 'pending' && <Clock className="w-5 h-5" />}
            {requestStatus === 'approved' && <CheckCircle2 className="w-5 h-5" />}
            {requestStatus === 'rejected' && <XCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="text-base font-semibold text-slate-900">
              {statusInfo.title}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {statusInfo.message}
            </p>
            {statusInfo.action && (
              <Link
                to="/buyer-profile"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors mt-3 group"
              >
                <UserCircle className="w-4 h-4" />
                Update your buyer profile
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="space-y-0" role="list" aria-label="Request progress">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0" role="listitem">
              {/* Connector Line */}
              {!isLast && (
                <div 
                  className={cn(
                    "absolute left-[18px] top-9 w-px h-full",
                    step.status === 'completed' ? "bg-slate-300" : "bg-slate-200"
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step Icon */}
              <div className={cn(
                "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-white transition-colors",
                step.status === 'completed' && step.id !== 'declined' && "border-slate-400 text-slate-700",
                step.status === 'completed' && step.id === 'declined' && "border-slate-300 text-slate-500",
                step.status === 'active' && "border-slate-700 text-slate-900 bg-slate-50",
                step.status === 'pending' && "border-slate-200 text-slate-400"
              )}>
                {getStepIcon(step.status, step.id)}
              </div>

              {/* Step Content */}
              <div className="flex-1 pt-1">
                <h4 className={cn(
                  "text-sm font-semibold mb-1 transition-colors",
                  step.status === 'completed' && "text-slate-900",
                  step.status === 'active' && "text-slate-900",
                  step.status === 'pending' && "text-slate-500"
                )}>
                  {step.label}
                </h4>
                <p className={cn(
                  "text-sm leading-relaxed transition-colors",
                  step.status === 'completed' && "text-slate-600",
                  step.status === 'active' && "text-slate-700",
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
