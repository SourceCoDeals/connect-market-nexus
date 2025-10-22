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
    <div className={cn("space-y-4", className)} role="list" aria-label="Deal progress timeline">
      {steps.map((step, index) => (
        <div 
          key={step.id} 
          className="relative flex gap-4 group transition-all duration-150 hover:bg-gray-50/50 rounded-lg px-3 py-2 -mx-3 -my-2" 
          role="listitem"
        >
          {/* Left Column - Connector & Icon */}
          <div className="flex flex-col items-center shrink-0">
            {/* Step Circle with Number */}
            <div className="relative">
              {step.completed ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300 group-hover:scale-110 shadow-sm relative">
                  <CheckCircle2 className="h-5 w-5" aria-label="Completed" />
                  <span className="sr-only">Step {index + 1}</span>
                </div>
              ) : step.active ? (
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-white transition-all duration-300 group-hover:scale-110 shadow-sm">
                  <span className="text-sm font-semibold text-primary">{index + 1}</span>
                  <div className="absolute inset-0 rounded-full border-2 border-primary animate-pulse opacity-20" aria-hidden="true" />
                  <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" aria-hidden="true" />
                  <span className="sr-only">Step {index + 1} - In Progress</span>
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-gray-600 transition-all duration-300 group-hover:border-gray-300">
                  <span className="text-sm font-semibold">{index + 1}</span>
                  <span className="sr-only">Step {index + 1}</span>
                </div>
              )}
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div 
                className={cn(
                  "w-0.5 flex-1 mt-2 transition-all duration-300",
                  step.completed 
                    ? "bg-primary group-hover:bg-primary/80" 
                    : "bg-gray-200 group-hover:bg-gray-300"
                )}
                style={{ minHeight: "40px" }}
                aria-hidden="true"
              />
            )}
          </div>

          {/* Right Column - Content */}
          <div className="flex-1 pb-6">
            <div className="flex items-start justify-between gap-4 mb-1.5">
              <h3 
                className={cn(
                  "text-sm font-medium transition-colors duration-200",
                  step.completed && "text-foreground",
                  step.active && "text-foreground font-semibold",
                  !step.completed && !step.active && "text-gray-600"
                )}
              >
                {step.label}
              </h3>
              
              {/* Status Badge */}
              {step.completed && (
                <Badge 
                  variant="success" 
                  className="text-[10px] px-2 py-0.5 h-5 shrink-0 font-medium transition-all duration-200 hover:bg-green-200"
                >
                  Complete
                </Badge>
              )}
              {step.active && (
                <Badge 
                  variant="default" 
                  className="text-[10px] px-2 py-0.5 h-5 shrink-0 font-medium transition-all duration-200 hover:bg-primary/90"
                >
                  In Progress
                </Badge>
              )}
            </div>
            
            {step.description && (
              <p className="text-sm text-gray-600 leading-5">
                {step.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
