import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  name: string;
  description: string;
}

interface WizardNavigationProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function WizardNavigation({ steps, currentStep, onStepClick }: WizardNavigationProps) {
  return (
    <nav className="space-y-1">
      {steps.map((step) => {
        const isCompleted = step.id < currentStep;
        const isCurrent = step.id === currentStep;
        const isClickable = step.id <= currentStep;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => isClickable && onStepClick(step.id)}
            disabled={!isClickable}
            className={cn(
              "w-full text-left px-3 py-3 rounded-lg transition-all",
              "flex items-start gap-3 group",
              isCurrent && "bg-primary/10 border border-primary/20",
              !isCurrent && isClickable && "hover:bg-muted",
              !isClickable && "opacity-50 cursor-not-allowed"
            )}
          >
            {/* Step Indicator */}
            <div
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                isCompleted && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : step.id}
            </div>

            {/* Step Content */}
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm font-medium",
                  isCurrent && "text-foreground",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {step.name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {step.description}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
