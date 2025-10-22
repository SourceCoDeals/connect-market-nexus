import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        return (
          <div key={step.id} className="relative flex gap-4">
            {/* Connector Line */}
            {!isLast && (
              <div 
                className={cn(
                  "absolute left-[15px] top-8 bottom-0 w-[2px]",
                  step.completed ? "bg-foreground" : "bg-border"
                )}
                style={{ height: 'calc(100% + 8px)' }}
              />
            )}
            
            {/* Step Icon */}
            <div className="relative z-10 flex-shrink-0 pt-1">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300",
                step.completed && "border-foreground bg-foreground",
                step.active && !step.completed && "border-foreground bg-background",
                !step.active && !step.completed && "border-border bg-background"
              )}>
                {step.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                ) : step.active ? (
                  <Clock className="h-4 w-4 text-foreground" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            
            {/* Step Content */}
            <div className={cn(
              "flex-1 pb-8",
              isLast && "pb-0"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className={cn(
                    "text-sm font-medium tracking-tight transition-colors",
                    step.active ? "text-foreground" : "text-muted-foreground/70"
                  )}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                
                {/* Status Badge */}
                {step.completed && (
                  <span className="text-xs font-medium text-muted-foreground/50">
                    Complete
                  </span>
                )}
                {step.active && !step.completed && (
                  <span className="text-xs font-medium text-foreground/70">
                    In Progress
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
