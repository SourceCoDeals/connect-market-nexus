import { cn } from "@/lib/utils";
import { MapPin, DollarSign, Briefcase, Target } from "lucide-react";

interface ScoreBreakdownProps {
  geography: number;
  size: number;
  service: number;
  ownerGoals: number;
  weights?: {
    geography: number;
    size: number;
    service: number;
    ownerGoals: number;
  };
  showWeights?: boolean;
  compact?: boolean;
  className?: string;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 70) return "text-lime-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 50) return "text-orange-600";
  return "text-red-600";
};

const getScoreBgColor = (score: number) => {
  if (score >= 80) return "bg-emerald-100";
  if (score >= 70) return "bg-lime-100";
  if (score >= 60) return "bg-amber-100";
  if (score >= 50) return "bg-orange-100";
  return "bg-red-100";
};

const categories = [
  { key: 'geography', label: 'Geography', icon: MapPin },
  { key: 'size', label: 'Size', icon: DollarSign },
  { key: 'service', label: 'Service', icon: Briefcase },
  { key: 'ownerGoals', label: 'Owner Goals', icon: Target },
] as const;

export const ScoreBreakdown = ({ 
  geography, 
  size, 
  service, 
  ownerGoals,
  weights,
  showWeights = false,
  compact = false,
  className 
}: ScoreBreakdownProps) => {
  const scores = { geography, size, service, ownerGoals };
  const defaultWeights = { geography: 35, size: 25, service: 25, ownerGoals: 15 };
  const actualWeights = weights || defaultWeights;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        {categories.map(({ key, label, icon: Icon }) => {
          const score = scores[key];
          return (
            <div key={key} className="flex items-center gap-1">
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className={cn("text-sm font-medium", getScoreColor(score))}>
                {Math.round(score)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-4 gap-3", className)}>
      {categories.map(({ key, label, icon: Icon }) => {
        const score = scores[key];
        const weight = actualWeights[key];
        
        return (
          <div 
            key={key} 
            className={cn(
              "rounded-lg p-3",
              getScoreBgColor(score)
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-xl font-bold", getScoreColor(score))}>
                {Math.round(score)}
              </span>
              {showWeights && (
                <span className="text-xs text-muted-foreground">
                  ({weight}%)
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ScoreBreakdown;
