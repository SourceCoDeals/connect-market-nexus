import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User } from '@/types';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { getProfileCompletionDetails } from '@/lib/buyer-metrics';

interface UserDataCompletenessProps {
  user: User;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function UserDataCompleteness({ user, showProgress = false, size = 'md' }: UserDataCompletenessProps) {
  // Use centralized completion logic
  const completionDetails = getProfileCompletionDetails(user);
  const completionPercentage = completionDetails.percentage;
  const missingCount = completionDetails.missingFields.length;

  // Get styling based on completion with better color coding
  const getCompletionBadge = (percentage: number) => {
    if (percentage >= 80) return { variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 };
    if (percentage >= 50) return { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Info };
    return { variant: 'destructive' as const, className: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle };
  };

  const { variant, className, icon: Icon } = getCompletionBadge(completionPercentage);

  // Format missing fields for display
  const getMissingFieldsFormatted = () => {
    return completionDetails.missingFieldLabels.join(', ');
  };

  if (size === 'sm') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={variant} className={`cursor-help ${className}`}>
              <Icon className="h-3 w-3 mr-1" />
              {completionPercentage}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <p className="font-medium">Profile Completion: {completionPercentage}%</p>
              <p className="text-xs">
                {completionDetails.requiredFields.length - missingCount} of {completionDetails.requiredFields.length} fields completed
              </p>
              {missingCount > 0 && (
                <div className="text-xs">
                  <p className="font-medium text-amber-600">Missing {missingCount} fields:</p>
                  <p className="mt-1">{getMissingFieldsFormatted()}</p>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={variant}>
          <Icon className="h-4 w-4 mr-1" />
          {completionPercentage}% Complete
        </Badge>
        <span className="text-sm text-muted-foreground">
          {completionDetails.requiredFields.length - missingCount}/{completionDetails.requiredFields.length} fields
        </span>
      </div>

      {showProgress && (
        <div className="space-y-2">
          <Progress value={completionPercentage} className="h-2" />
          {missingCount > 0 && (
            <div className="text-xs text-muted-foreground">
              Missing: {getMissingFieldsFormatted()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}