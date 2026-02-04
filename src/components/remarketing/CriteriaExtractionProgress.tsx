import { Loader2, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface CriteriaExtractionProgressProps {
  universeName?: string;
}

export const CriteriaExtractionProgress = ({
  universeName,
}: CriteriaExtractionProgressProps) => {
  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm text-amber-900 dark:text-amber-100">
                Extracting criteria{universeName ? ` from ${universeName} guide` : ''}...
              </p>
            </div>
            <Progress value={undefined} className="h-2 [&>div]:animate-pulse" />
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              Analyzing guide content and identifying buyer fit criteria
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CriteriaExtractionProgress;
