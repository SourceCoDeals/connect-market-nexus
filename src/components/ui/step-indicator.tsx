import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function StepIndicator({ currentStep, totalSteps, className }: StepIndicatorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Step text - peec.ai style */}
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Step {currentStep + 1}/{totalSteps}
      </p>
      
      {/* Thin progress bar */}
      <div className="w-full bg-muted h-0.5 rounded-full overflow-hidden">
        <div
          className="bg-foreground/70 h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${((currentStep + 1) / totalSteps) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

interface StepIndicatorMinimalProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function StepIndicatorMinimal({ currentStep, totalSteps, className }: StepIndicatorMinimalProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Step text */}
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Step {currentStep + 1}/{totalSteps}
      </p>
      
      {/* Progress bar */}
      <div className="w-full bg-muted h-0.5 rounded-full overflow-hidden">
        <div
          className="bg-foreground/70 h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${((currentStep + 1) / totalSteps) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
