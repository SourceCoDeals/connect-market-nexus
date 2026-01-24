import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface ScoringProgressIndicatorProps {
  currentCount: number;
  expectedCount: number;
  progress: number;
  universeName?: string;
}

export const ScoringProgressIndicator = ({
  currentCount,
  expectedCount,
  progress,
  universeName,
}: ScoringProgressIndicatorProps) => {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">
                Scoring buyers{universeName ? ` in ${universeName}` : ''}...
              </p>
              <span className="text-sm text-muted-foreground">
                {currentCount} of {expectedCount}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScoringProgressIndicator;
