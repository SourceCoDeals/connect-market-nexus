import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Settings2,
  ChevronDown,
  Sparkles,
  RotateCcw,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoringInstructionsPanelProps {
  customInstructions: string;
  onInstructionsChange: (value: string) => void;
  onApplyAndRescore: (instructions: string) => void;
  onReset: () => void;
  isScoring?: boolean;
  className?: string;
}

const QUICK_ACTION_CHIPS = [
  { label: "Quick close needed", value: "Quick close needed (60 days or less) - prioritize buyers with fast close track records" },
  { label: "Owner wants to stay", value: "Owner wants to stay and retain equity rollover - boost buyers who support owner transitions and equity rollovers" },
  { label: "Key employees must stay", value: "Key employees must be retained - prioritize buyers who retain existing management teams" },
  { label: "Single location OK", value: "Single location is acceptable despite size criteria - do not penalize single-location deals" },
];

export const ScoringInstructionsPanel = ({
  customInstructions,
  onInstructionsChange,
  onApplyAndRescore,
  onReset,
  isScoring = false,
  className,
}: ScoringInstructionsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

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
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Custom Scoring Instructions</span>
              </div>

              {customInstructions && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  Active
                </Badge>
              )}
            </div>

            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-3 border-t">
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Guide the AI scoring engine with deal-specific context
                </span>
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

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => onApplyAndRescore(customInstructions)}
                  disabled={isScoring || !customInstructions}
                >
                  {isScoring ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Apply & Re-score
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  disabled={isScoring}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ScoringInstructionsPanel;
