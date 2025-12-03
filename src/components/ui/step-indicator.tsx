import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function StepIndicator({ currentStep, totalSteps, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1;
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;

        return (
          <div key={i} className="flex items-center gap-3">
            {/* Step dot/number */}
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all duration-200",
                isActive && "bg-foreground text-background",
                isCompleted && "bg-foreground/80 text-background",
                !isActive && !isCompleted && "bg-muted text-muted-foreground"
              )}
            >
              {stepNumber}
            </div>

            {/* Connector line */}
            {i < totalSteps - 1 && (
              <div
                className={cn(
                  "w-8 h-[2px] transition-all duration-200",
                  isCompleted ? "bg-foreground/60" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
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
      <p className="text-sm text-muted-foreground text-center">
        Step {currentStep + 1} of {totalSteps}
      </p>
      
      {/* Progress bar */}
      <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
        <div
          className="bg-foreground h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${((currentStep + 1) / totalSteps) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
