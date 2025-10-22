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
    <div className={cn("w-full", className)} role="progressbar" aria-valuenow={completedSteps} aria-valuemax={steps.length}>
      {/* Progress Line */}
      <div className="relative mb-8">
        {/* Background Line */}
        <div className="absolute top-3 left-0 right-0 h-px bg-gray-200" aria-hidden="true" />
        {/* Progress Line */}
        <div 
          className="absolute top-3 left-0 h-px bg-gray-400 transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
          aria-hidden="true"
        />

        {/* Step Markers */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center">
              {/* Step Circle */}
              <div className="relative mb-2">
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

              {/* Step Label */}
              <span 
                className={cn(
                  "text-xs text-center max-w-[80px]",
                  step.completed && "text-gray-900 font-medium",
                  step.active && "text-gray-900 font-medium",
                  !step.completed && !step.active && "text-gray-500"
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
