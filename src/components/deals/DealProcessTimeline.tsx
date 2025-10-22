import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TimelineStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  active: boolean;
}

interface DealProcessTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function DealProcessTimeline({ steps, className }: DealProcessTimelineProps) {
  return (
    <div className={cn("space-y-0", className)} role="list" aria-label="Deal process timeline">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        return (
          <div key={step.id} className="relative flex gap-4 pb-6" role="listitem">
            {/* Connector Line */}
            {!isLast && (
              <div 
                className={cn(
                  "absolute left-3 top-7 w-px h-full",
                  step.completed ? "bg-gray-300" : "bg-gray-200"
                )}
                aria-hidden="true"
              />
            )}

            {/* Step Icon */}
            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
              {step.completed ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <CheckCircle2 className="h-4 w-4" aria-label="Completed" />
                </div>
              ) : step.active ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-900 bg-white">
                  <div className="h-2 w-2 rounded-full bg-gray-900" />
                </div>
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300 bg-white" />
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1 pt-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 
                  className={cn(
                    "text-sm font-semibold",
                    step.completed && "text-gray-900",
                    step.active && "text-gray-900",
                    !step.completed && !step.active && "text-gray-500"
                  )}
                >
                  {step.label}
                </h3>
                
                {/* Status Badge - Simple pill */}
                {step.active && (
                  <Badge
                    variant="outline"
                    className="text-xs px-2 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200 rounded-full font-medium"
                  >
                    In Progress
                  </Badge>
                )}
                {step.completed && (
                  <Badge
                    variant="outline"
                    className="text-xs px-2 py-0 h-5 bg-emerald-50 text-emerald-700 border-emerald-200 rounded-full font-medium"
                  >
                    Complete
                  </Badge>
                )}
              </div>
              
              <p 
                className={cn(
                  "text-sm leading-6",
                  step.active ? "text-gray-600" : "text-gray-500"
                )}
              >
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
