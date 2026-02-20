import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Settings2,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  MapPin,
  DollarSign,
  Briefcase,
  Target,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoringInsightsSidebarProps {
  universeId?: string;
  universeName?: string;
  weights: {
    geography: number;
    size: number;
    service: number;
    ownerGoals: number;
  };
  outcomeStats: {
    approved: number;
    passed: number;
    removed: number;
  };
  decisionCount: number;
  isWeightsAdjusted?: boolean;
  onRecalculate: () => void;
  onReset: () => void;
  isRecalculating?: boolean;
  className?: string;
}

const categoryConfig = [
  { key: 'geography', label: 'Geography', icon: MapPin, color: 'bg-blue-500' },
  { key: 'size', label: 'Size', icon: DollarSign, color: 'bg-emerald-500' },
  { key: 'service', label: 'Services', icon: Briefcase, color: 'bg-purple-500' },
  { key: 'ownerGoals', label: 'Owner Goals', icon: Target, color: 'bg-amber-500' },
];

export const ScoringInsightsSidebar = ({
  universeId,
  universeName,
  weights,
  outcomeStats,
  decisionCount,
  isWeightsAdjusted = false,
  onRecalculate,
  onReset,
  isRecalculating = false,
  className,
}: ScoringInsightsSidebarProps) => {
  const [isDecisionsOpen, setIsDecisionsOpen] = useState(false);

  return (
    <Card className={cn("sticky top-6", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Scoring Insights
          </CardTitle>
          {isWeightsAdjusted && (
            <Badge variant="secondary" className="text-xs">
              Weights Adjusted
            </Badge>
          )}
        </div>
        
        {/* Based on N decisions - Collapsible */}
        {decisionCount > 0 && (
          <Collapsible open={isDecisionsOpen} onOpenChange={setIsDecisionsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
              <span>Based on {decisionCount} decisions</span>
              <ChevronDown className={cn(
                "h-3 w-3 transition-transform",
                isDecisionsOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {outcomeStats.approved} approved
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {outcomeStats.passed} passed
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {outcomeStats.removed} removed
                </span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Category Progress Bars */}
        <div className="space-y-3">
          {categoryConfig.map((cat) => {
            const weight = weights[cat.key as keyof typeof weights];
            const Icon = cat.icon;
            
            return (
              <div key={cat.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {cat.label}
                  </span>
                  <span className="font-medium">{weight}%</span>
                </div>
                <Progress 
                  value={weight} 
                  className="h-2"
                />
              </div>
            );
          })}
        </div>

        {/* Outcome Stats - Visual Display */}
        <div className="pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Outcomes
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {outcomeStats.approved}
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <MinusCircle className="h-3.5 w-3.5" />
              {outcomeStats.passed}
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-3.5 w-3.5" />
              {outcomeStats.removed}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          {universeId && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to={`/admin/buyers/universes/${universeId}/settings`}>
                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                Customize Scoring
              </Link>
            </Button>
          )}
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={onRecalculate}
              disabled={isRecalculating}
            >
              <RefreshCw className={cn(
                "h-3.5 w-3.5 mr-1.5",
                isRecalculating && "animate-spin"
              )} />
              Recalculate
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1"
              onClick={onReset}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScoringInsightsSidebar;
