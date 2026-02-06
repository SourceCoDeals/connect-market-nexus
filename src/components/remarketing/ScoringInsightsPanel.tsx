import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoringInsightsPanelProps {
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
  customInstructions: string;
  onInstructionsChange: (value: string) => void;
  onApplyAndRescore: (instructions: string) => void;
  onRecalculate: () => void;
  onReset: () => void;
  isRecalculating?: boolean;
  className?: string;
}

const QUICK_ACTION_CHIPS = [
  { label: "Quick close needed", value: "Quick close needed (60 days or less) - prioritize buyers with fast close track records" },
  { label: "Owner wants to stay", value: "Owner wants to stay and retain equity rollover - boost buyers who support owner transitions and equity rollovers" },
  { label: "Key employees must stay", value: "Key employees must be retained - prioritize buyers who retain existing management teams" },
  { label: "Single location OK", value: "Single location is acceptable despite size criteria - do not penalize single-location deals" },
];

const categoryConfig = [
  { key: 'service', label: 'Services', icon: Briefcase, color: 'bg-purple-500' },
  { key: 'size', label: 'Size', icon: DollarSign, color: 'bg-emerald-500' },
  { key: 'geography', label: 'Geography', icon: MapPin, color: 'bg-blue-500' },
  { key: 'ownerGoals', label: 'Owner Goals', icon: Target, color: 'bg-amber-500' },
];

export const ScoringInsightsPanel = ({
  universeId,
  universeName,
  weights,
  outcomeStats,
  decisionCount,
  isWeightsAdjusted = false,
  customInstructions,
  onInstructionsChange,
  onApplyAndRescore,
  onRecalculate,
  onReset,
  isRecalculating = false,
  className,
}: ScoringInsightsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDecisionsOpen, setIsDecisionsOpen] = useState(false);

  const handleChipClick = (chipValue: string) => {
    const newValue = customInstructions
      ? `${customInstructions}\n${chipValue}`
      : chipValue;
    onInstructionsChange(newValue);
  };

  const handleClearInstructions = () => {
    onInstructionsChange("");
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Collapsed Header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Scoring Insights</span>
              </div>
              
              {isWeightsAdjusted && (
                <Badge variant="secondary" className="text-xs">
                  Weights Adjusted
                </Badge>
              )}
              
              {customInstructions && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  Custom Instructions
                </Badge>
              )}
              
              {/* Decisions dropdown trigger (inline) */}
              {decisionCount > 0 && (
                <Collapsible open={isDecisionsOpen} onOpenChange={(open) => {
                  // Prevent parent collapsible from triggering
                  setIsDecisionsOpen(open);
                }}>
                  <CollapsibleTrigger 
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>Based on {decisionCount} decisions</span>
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform",
                      isDecisionsOpen && "rotate-180"
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="absolute mt-1 bg-background border rounded-md shadow-md p-2 z-10">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        {outcomeStats.approved} approved
                      </span>
                      <span className="flex items-center gap-1 text-amber-600">
                        <MinusCircle className="h-3 w-3" />
                        {outcomeStats.passed} passed
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-3 w-3" />
                        {outcomeStats.removed} removed
                      </span>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {/* Mini weight badges when collapsed */}
              {!isOpen && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3 text-purple-500" />
                    {weights.service}%
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-emerald-500" />
                    {weights.size}%
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-blue-500" />
                    {weights.geography}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3 text-amber-500" />
                    {weights.ownerGoals}%
                  </span>
                </div>
              )}
              
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )} />
            </div>
          </div>
        </CollapsibleTrigger>
        
        {/* Expanded Content */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4 border-t">
            {/* Category Progress Bars */}
            <div className="grid grid-cols-4 gap-4 pt-4">
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

            {/* Outcome Stats */}
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                {outcomeStats.approved} approved
              </span>
              <span className="flex items-center gap-1.5 text-amber-600">
                <MinusCircle className="h-4 w-4" />
                {outcomeStats.passed} passed
              </span>
              <span className="flex items-center gap-1.5 text-red-600">
                <XCircle className="h-4 w-4" />
                {outcomeStats.removed} removed
              </span>
            </div>

            {/* Divider */}
            <div className="border-t pt-4">
              {/* Custom Scoring Instructions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Custom Scoring Instructions</span>
                  </div>
                  {customInstructions && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={handleClearInstructions}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                
                <Textarea
                  value={customInstructions}
                  onChange={(e) => onInstructionsChange(e.target.value)}
                  placeholder="e.g., No DRP relationships - prioritize buyers comfortable with non-DRP shops"
                  className="min-h-[80px] text-sm resize-none"
                />
                
                {/* Quick Action Chips */}
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTION_CHIPS.map((chip) => (
                    <Button
                      key={chip.label}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs rounded-full"
                      onClick={() => handleChipClick(chip.value)}
                    >
                      {chip.label}
                    </Button>
                  ))}
                </div>
                
                {/* Apply & Re-score Button */}
                <Button 
                  className="w-full"
                  onClick={() => onApplyAndRescore(customInstructions)}
                  disabled={isRecalculating || !customInstructions}
                >
                  {isRecalculating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Apply & Re-score
                </Button>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center gap-2 pt-2 border-t">
              {universeId && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/admin/remarketing/universes/${universeId}/settings`}>
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                    Customize Scoring
                  </Link>
                </Button>
              )}
              
              <div className="flex-1" />
              
              <Button 
                variant="outline" 
                size="sm"
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
                onClick={onReset}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ScoringInsightsPanel;
