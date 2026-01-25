import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { validateCriteria, ValidationResult } from "@/lib/criteriaValidation";
import { SizeCriteria, GeographyCriteria, ServiceCriteria, BuyerTypesCriteria, ScoringBehavior } from "@/types/remarketing";

interface CriteriaValidationAlertProps {
  sizeCriteria: SizeCriteria;
  geographyCriteria: GeographyCriteria;
  serviceCriteria: ServiceCriteria;
  buyerTypesCriteria: BuyerTypesCriteria;
  scoringBehavior?: ScoringBehavior;
  showOnlyBlockers?: boolean;
}

export const CriteriaValidationAlert = ({
  sizeCriteria,
  geographyCriteria,
  serviceCriteria,
  buyerTypesCriteria,
  scoringBehavior,
  showOnlyBlockers = false
}: CriteriaValidationAlertProps) => {
  const validation = validateCriteria({
    size_criteria: sizeCriteria,
    geography_criteria: geographyCriteria,
    service_criteria: serviceCriteria,
    buyer_types_criteria: buyerTypesCriteria,
    scoring_behavior: scoringBehavior
  });

  // If everything is valid and we're only showing blockers, return null
  if (showOnlyBlockers && validation.blockers.length === 0) {
    return null;
  }

  // If everything is completely valid, show success
  if (validation.isComplete && validation.blockers.length === 0 && validation.warnings.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800 dark:text-green-200">Criteria Ready</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          All required fields are populated. Completeness: {validation.completenessScore}%
        </AlertDescription>
      </Alert>
    );
  }

  // If there are blockers, show error
  if (validation.blockers.length > 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Cannot Score - Missing Required Fields</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1">
            {validation.blockers.map((blocker, i) => (
              <li key={i}>{blocker}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  // If there are warnings
  if (validation.warnings.length > 0 && !showOnlyBlockers) {
    return (
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
          Criteria Incomplete
          <Badge variant="secondary" className="text-xs">
            {validation.completenessScore}% complete
          </Badge>
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          <ul className="list-disc list-inside mt-2 space-y-1">
            {validation.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
          {validation.suggestions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-300 dark:border-amber-700">
              <span className="font-medium">Suggestions:</span>
              <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                {validation.suggestions.slice(0, 3).map((suggestion, i) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Just show info if low completeness
  if (validation.completenessScore < 50 && !showOnlyBlockers) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Low Criteria Completeness
          <Badge variant="outline">{validation.completenessScore}%</Badge>
        </AlertTitle>
        <AlertDescription>
          Consider using AI Research or Quick Import to populate criteria for better scoring accuracy.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

// Inline validation summary for headers
export const CriteriaValidationBadge = ({
  sizeCriteria,
  geographyCriteria,
  serviceCriteria,
  buyerTypesCriteria,
}: Omit<CriteriaValidationAlertProps, 'showOnlyBlockers' | 'scoringBehavior'>) => {
  const validation = validateCriteria({
    size_criteria: sizeCriteria,
    geography_criteria: geographyCriteria,
    service_criteria: serviceCriteria,
    buyer_types_criteria: buyerTypesCriteria
  });

  if (validation.blockers.length > 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        <AlertCircle className="h-3 w-3 mr-1" />
        Missing Required
      </Badge>
    );
  }

  if (validation.completenessScore >= 80) {
    return (
      <Badge variant="default" className="bg-green-600 text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        {validation.completenessScore}% Complete
      </Badge>
    );
  }

  if (validation.completenessScore >= 50) {
    return (
      <Badge variant="secondary" className="text-xs">
        {validation.completenessScore}% Complete
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      {validation.completenessScore}% Complete
    </Badge>
  );
};
