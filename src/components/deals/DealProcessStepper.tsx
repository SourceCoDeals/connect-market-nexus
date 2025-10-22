import { CheckCircle2 } from "lucide-react";
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
  const completedSteps = steps.filter(s => s.completed).length;
  const progressPercentage = ((completedSteps - 1) / (steps.length - 1)) * 100;

  return (
    <div className={cn("w-full px-4", className)} role="progressbar" aria-valuenow={completedSteps} aria-valuemax={steps.length}>
      {/* Progress Line */}
      <div className="relative mb-8">
        {/* Background Line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" aria-hidden="true" />
        {/* Progress Line */}
        <div 
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
          aria-hidden="true"
        />

        {/* Step Markers */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center group">
              {/* Step Circle with Number */}
              <div className="relative mb-2">
                {step.completed ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300 group-hover:scale-110 shadow-sm">
                    <CheckCircle2 className="h-5 w-5" aria-label="Completed" />
                  </div>
                ) : step.active ? (
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background transition-all duration-300 animate-pulse group-hover:scale-110 shadow-sm">
                    <span className="text-sm font-semibold text-primary">{index + 1}</span>
                    <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" aria-hidden="true" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-background text-muted-foreground transition-all duration-300 group-hover:border-muted-foreground">
                    <span className="text-sm font-semibold">{index + 1}</span>
                  </div>
                )}
              </div>

              {/* Step Label */}
              <span 
                className={cn(
                  "text-xs text-center max-w-[80px] transition-colors duration-200",
                  step.completed && "text-foreground font-medium",
                  step.active && "text-foreground font-medium",
                  !step.completed && !step.active && "text-muted-foreground/60"
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
