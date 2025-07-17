
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { PasswordStrengthResult } from '@/lib/password-security';

interface PasswordStrengthIndicatorProps {
  password: string;
  strengthResult?: PasswordStrengthResult;
  showDetails?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  strengthResult,
  showDetails = true
}) => {
  if (!password) return null;

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'very_weak': return 'hsl(var(--destructive))';
      case 'weak': return 'hsl(var(--destructive))';
      case 'fair': return 'hsl(var(--warning))';
      case 'strong': return 'hsl(var(--success))';
      case 'very_strong': return 'hsl(var(--success))';
      default: return 'hsl(var(--muted))';
    }
  };

  const getStrengthText = (strength: string) => {
    switch (strength) {
      case 'very_weak': return 'Very Weak';
      case 'weak': return 'Weak';
      case 'fair': return 'Fair';
      case 'strong': return 'Strong';
      case 'very_strong': return 'Very Strong';
      default: return 'Unknown';
    }
  };

  if (!strengthResult) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Progress value={0} className="flex-1" />
          <span className="text-sm text-muted-foreground">Checking...</span>
        </div>
      </div>
    );
  }

  const strengthColor = getStrengthColor(strengthResult.strength);
  const strengthText = getStrengthText(strengthResult.strength);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Progress 
          value={strengthResult.score * 20} 
          className="flex-1"
          style={{ '--progress-foreground': strengthColor } as React.CSSProperties}
        />
        <Badge 
          variant={strengthResult.meets_policy ? 'default' : 'destructive'}
          className="text-xs"
        >
          {strengthText}
        </Badge>
      </div>

      {showDetails && strengthResult.feedback.length > 0 && (
        <div className="space-y-1">
          {strengthResult.feedback.map((feedback, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              {strengthResult.meets_policy ? (
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-muted-foreground">{feedback}</span>
            </div>
          ))}
        </div>
      )}

      {!strengthResult.meets_policy && (
        <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <span className="text-sm text-destructive">
            Password does not meet security policy requirements
          </span>
        </div>
      )}
    </div>
  );
};
