import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  label: string;
  completed: boolean;
  active: boolean;
}

interface DealProcessStageProps {
  stages: Stage[];
}

export function DealProcessStage({ stages }: DealProcessStageProps) {
  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between">
        {/* Progress line */}
        <div className="absolute left-0 right-0 h-[2px] bg-border top-1/2 -translate-y-1/2" 
             style={{ left: '24px', right: '24px' }}>
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ 
              width: `${(stages.filter(s => s.completed).length / (stages.length - 1)) * 100}%` 
            }}
          />
        </div>
        
        {/* Stage markers */}
        {stages.map((stage, index) => (
          <div key={stage.id} className="relative flex flex-col items-center z-10">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center border-2 bg-background transition-all duration-300",
              stage.completed && "border-primary bg-primary",
              stage.active && !stage.completed && "border-primary bg-background",
              !stage.active && !stage.completed && "border-border bg-background"
            )}>
              {stage.completed ? (
                <CheckCircle2 className="w-6 h-6 text-primary-foreground" />
              ) : (
                <Circle className={cn(
                  "w-6 h-6",
                  stage.active ? "text-primary" : "text-muted-foreground"
                )} />
              )}
            </div>
            <div className="absolute top-14 text-center">
              <p className={cn(
                "text-sm font-medium whitespace-nowrap",
                stage.active ? "text-foreground" : "text-muted-foreground"
              )}>
                {stage.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
