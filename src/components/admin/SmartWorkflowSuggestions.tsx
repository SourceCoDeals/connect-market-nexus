import { AlertTriangle, CheckCircle, Clock, Lightbulb } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User as UserType } from "@/types";

interface SmartWorkflowSuggestionsProps {
  user: UserType;
  onSuggestedAction?: (action: string, user: UserType) => void;
}

export function SmartWorkflowSuggestions({ 
  user, 
  onSuggestedAction 
}: SmartWorkflowSuggestionsProps) {
  const suggestions = [];

  // NDA workflow suggestions
  if (!user.nda_signed && !user.nda_email_sent) {
    suggestions.push({
      type: 'warning',
      icon: AlertTriangle,
      title: 'NDA Required',
      description: 'User needs to sign NDA before approval',
      action: 'send_nda',
      actionLabel: 'Send NDA',
      priority: 'high'
    });
  } else if (user.nda_email_sent && !user.nda_signed) {
    suggestions.push({
      type: 'info',
      icon: Clock,
      title: 'NDA Pending',
      description: 'NDA sent, waiting for signature',
      action: null,
      actionLabel: null,
      priority: 'medium'
    });
  }

  // Fee Agreement workflow suggestions
  if (!user.fee_agreement_signed && !user.fee_agreement_email_sent) {
    suggestions.push({
      type: 'warning',
      icon: AlertTriangle,
      title: 'Fee Agreement Required',
      description: 'User needs fee agreement before access',
      action: 'send_fee_agreement',
      actionLabel: 'Send Fee Agreement',
      priority: 'high'
    });
  } else if (user.fee_agreement_email_sent && !user.fee_agreement_signed) {
    suggestions.push({
      type: 'info',
      icon: Clock,
      title: 'Fee Agreement Pending',
      description: 'Fee agreement sent, waiting for signature',
      action: null,
      actionLabel: null,
      priority: 'medium'
    });
  }

  // Approval workflow suggestions
  if (user.approval_status === 'pending' && user.nda_signed && user.fee_agreement_signed) {
    suggestions.push({
      type: 'success',
      icon: CheckCircle,
      title: 'Ready for Approval',
      description: 'All requirements met, user can be approved',
      action: 'approve_user',
      actionLabel: 'Approve User',
      priority: 'high'
    });
  }

  // Smart optimization suggestions
  if (user.approval_status === 'pending' && !user.nda_signed && !user.fee_agreement_signed) {
    suggestions.push({
      type: 'info',
      icon: Lightbulb,
      title: 'Workflow Optimization',
      description: 'Consider sending both NDA and Fee Agreement together',
      action: 'send_both',
      actionLabel: 'Send Both',
      priority: 'low'
    });
  }

  if (suggestions.length === 0) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'warning': return 'destructive';
      case 'success': return 'default';
      case 'info': return 'default';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-semibold text-sm">Smart Suggestions</h4>
      </div>
      
      {suggestions.map((suggestion, index) => {
        const IconComponent = suggestion.icon;
        
        return (
          <Alert key={index} variant={getAlertVariant(suggestion.type)} className="py-3">
            <IconComponent className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{suggestion.title}</span>
                  <Badge variant={getPriorityColor(suggestion.priority)} className="text-xs">
                    {suggestion.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {suggestion.description}
                </p>
              </div>
              
              {suggestion.action && suggestion.actionLabel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-3 text-xs"
                  onClick={() => onSuggestedAction?.(suggestion.action!, user)}
                >
                  {suggestion.actionLabel}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}