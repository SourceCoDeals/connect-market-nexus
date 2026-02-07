/**
 * Proactive Recommendation Card
 * Shows AI-generated recommendations for next actions
 */

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface Recommendation {
  id?: string;
  type: string;
  title: string;
  message: string;
  actionText: string;
  actionQuery?: string;
  priority: 'low' | 'medium' | 'high';
  reasoning: string;
}

interface ProactiveRecommendationProps {
  recommendation: Recommendation;
  onAccept: (query?: string) => void;
  onDismiss: () => void;
  className?: string;
}

export function ProactiveRecommendation({
  recommendation,
  onAccept,
  onDismiss,
  className,
}: ProactiveRecommendationProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss();
  };

  const handleAccept = () => {
    onAccept(recommendation.actionQuery);
  };

  const priorityColors = {
    high: 'bg-orange-100 border-orange-200 dark:bg-orange-950 dark:border-orange-800',
    medium: 'bg-blue-100 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
    low: 'bg-gray-100 border-gray-200 dark:bg-gray-900 dark:border-gray-800',
  };

  const priorityBadgeColors = {
    high: 'bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    medium: 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    low: 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <Card
      className={`${priorityColors[recommendation.priority]} border-2 ${className}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">{recommendation.title}</h4>
          </div>
          <div className="flex items-center gap-2">
            {recommendation.priority === 'high' && (
              <Badge variant="secondary" className={`text-xs ${priorityBadgeColors[recommendation.priority]}`}>
                Recommended
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-2 -mt-1"
              onClick={handleDismiss}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground">{recommendation.message}</p>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          size="sm"
          onClick={handleAccept}
          className="w-full"
          variant={recommendation.priority === 'high' ? 'default' : 'outline'}
        >
          {recommendation.actionText}
        </Button>
      </CardFooter>
    </Card>
  );
}
