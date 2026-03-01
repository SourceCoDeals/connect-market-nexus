import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, RotateCcw, Play } from 'lucide-react';

interface ScoringInstructionsPanelProps {
  customInstructions: string;
  onInstructionsChange: (instructions: string) => void;
  onApplyAndRescore: (instructions: string) => void;
  onReset: () => void;
  isScoring: boolean;
}

export const ScoringInstructionsPanel = ({
  customInstructions,
  onInstructionsChange,
  onApplyAndRescore,
  onReset,
  isScoring,
}: ScoringInstructionsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(!!customInstructions);

  return (
    <Card>
      <CardHeader className="cursor-pointer pb-3" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm">Custom Scoring Instructions</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {isExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-3 pt-0">
          <Textarea
            placeholder="Add custom instructions for the AI scorer, e.g. 'Prioritize buyers with collision repair experience' or 'Penalize buyers outside the Southeast region'..."
            value={customInstructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            rows={3}
            disabled={isScoring}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => onApplyAndRescore(customInstructions)}
              disabled={isScoring || !customInstructions.trim()}
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Apply & Rescore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onReset}
              disabled={isScoring || !customInstructions.trim()}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ScoringInstructionsPanel;
