import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperStep {
  id: string;
  label: string;
  completed: boolean;
  active: boolean;
}

interface DealProcessStepperProps {
  steps: StepperStep[];
  className?: string;
}

export function DealProcessStepper({ steps, className }: DealProcessStepperProps) {
  return (
    <div className={cn("w-full overflow-x-auto pb-2", className)}>
      <div className="relative flex items-center justify-between min-w-[280px]">
        {/* Progress line */}
        <div className="absolute left-0 right-0 h-[2px] bg-border top-4" 
             style={{ left: '16px', right: '16px' }}>
          <div 
            className="h-full bg-foreground transition-all duration-500"
            style={{ 
              width: `${(steps.filter(s => s.completed).length / Math.max(steps.length - 1, 1)) * 100}%` 
            }}
          />
        </div>
        
        {/* Step markers */}
        {steps.map((step) => (
          <div key={step.id} className="relative flex flex-col items-center z-10 flex-1">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2 bg-background transition-all duration-300",
              step.completed && "border-foreground bg-foreground",
              step.active && !step.completed && "border-foreground bg-background",
              !step.active && !step.completed && "border-border bg-background"
            )}>
              {step.completed ? (
                <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
              ) : step.active ? (
                <Clock className="w-4 h-4 text-foreground" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <p className={cn(
              "absolute top-10 text-[11px] font-medium whitespace-nowrap tracking-tight",
              step.active ? "text-foreground" : "text-muted-foreground/70"
            )}>
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
