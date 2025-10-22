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
          <div key={step.id} className="relative flex gap-4 pb-8 group" role="listitem">
            {/* Connector Line */}
            {!isLast && (
              <div 
                className={cn(
                  "absolute left-4 top-8 w-0.5 h-full transition-colors duration-300",
                  step.completed ? "bg-primary" : "bg-border"
                )}
                aria-hidden="true"
              />
            )}

            {/* Step Icon Circle with Number */}
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
              {step.completed ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300 group-hover:scale-110">
                  <CheckCircle2 className="h-5 w-5" aria-label="Completed" />
                </div>
              ) : step.active ? (
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background transition-all duration-300 animate-pulse group-hover:scale-110">
                  <span className="text-sm font-semibold text-primary">{index + 1}</span>
                  <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" aria-hidden="true" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-background text-muted-foreground transition-all duration-300 group-hover:border-muted-foreground">
                  <span className="text-sm font-semibold">{index + 1}</span>
                </div>
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1 pt-0.5 transition-all duration-200">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 
                  className={cn(
                    "text-sm font-semibold transition-colors duration-200",
                    step.completed && "text-foreground",
                    step.active && "text-foreground",
                    !step.completed && !step.active && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </h3>
                
                {/* Status Badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-2 py-0 h-5 transition-all duration-200",
                    step.completed && "bg-primary/10 text-primary border-primary/20",
                    step.active && "bg-amber-50/50 text-amber-700 border-amber-200/50 dark:bg-amber-950/50 dark:text-amber-300",
                    !step.completed && !step.active && "bg-muted/30 text-muted-foreground/50 border-border/30"
                  )}
                >
                  {step.completed ? "Complete" : step.active ? "In Progress" : "Pending"}
                </Badge>
              </div>
              
              <p 
                className={cn(
                  "text-xs leading-relaxed transition-colors duration-200",
                  step.active ? "text-muted-foreground" : "text-muted-foreground/60"
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
