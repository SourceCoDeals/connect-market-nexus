import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User } from '@/types';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { getRelevantFieldsForBuyerType, FIELD_LABELS } from '@/lib/buyer-type-fields';

interface UserDataCompletenessProps {
  user: User;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function UserDataCompleteness({ user, showProgress = false, size = 'md' }: UserDataCompletenessProps) {
  // Handle admin users and users without buyer_type
  const effectiveBuyerType = user.is_admin ? 'admin' : (user.buyer_type || 'corporate');
  
  // Get relevant fields for this user's buyer type using the central mapping
  const relevantFieldKeys = getRelevantFieldsForBuyerType(effectiveBuyerType as any);
  
  // Create field objects with labels and categories for completion calculation
  const applicableFields = relevantFieldKeys.map(key => ({
    key,
    label: FIELD_LABELS[key as keyof typeof FIELD_LABELS] || key,
    category: getCategoryForField(key),
  }));

  function getCategoryForField(fieldKey: string): string {
    if (['first_name', 'last_name', 'email', 'phone_number', 'company', 'website', 'linkedin_profile'].includes(fieldKey)) {
      return 'contact';
    }
    if (['ideal_target_description', 'business_categories', 'target_locations', 'specific_business_search', 'revenue_range_min', 'revenue_range_max'].includes(fieldKey)) {
      return 'profile';
    }
    return 'financial';
  }

  // Calculate completion
  const completedFields = applicableFields.filter(field => {
    const value = user[field.key as keyof User];
    if (field.key === 'business_categories') {
      return Array.isArray(value) && value.length > 0;
    }
    return value !== null && value !== undefined && value !== '';
  });

  const completionPercentage = Math.round((completedFields.length / applicableFields.length) * 100);
  const missingCount = applicableFields.length - completedFields.length;

  // Get styling based on completion
  const getCompletionBadge = (percentage: number) => {
    if (percentage >= 90) return { variant: 'default' as const, color: 'text-green-700', icon: CheckCircle2 };
    if (percentage >= 70) return { variant: 'secondary' as const, color: 'text-blue-700', icon: Info };
    return { variant: 'secondary' as const, color: 'text-blue-700', icon: AlertCircle };
  };

  const { variant, color, icon: Icon } = getCompletionBadge(completionPercentage);

  // Missing fields summary
  const missingFields = applicableFields.filter(field => {
    const value = user[field.key as keyof User];
    if (field.key === 'business_categories') {
      return !Array.isArray(value) || value.length === 0;
    }
    return value === null || value === undefined || value === '';
  });

  const getMissingFieldsByCategory = () => {
    return missingFields.reduce((acc, field) => {
      if (!acc[field.category]) acc[field.category] = [];
      acc[field.category].push(field.label);
      return acc;
    }, {} as Record<string, string[]>);
  };

  if (size === 'sm') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={variant} 
              className={`cursor-help px-2 py-1 ${
                completionPercentage >= 90 ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
                completionPercentage >= 70 ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : 
                'bg-amber-100 text-amber-800 hover:bg-amber-100'
              }`}
            >
              {completionPercentage}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <p className="font-medium">Profile Completion: {completionPercentage}%</p>
              <p className="text-xs">
                {completedFields.length} of {applicableFields.length} required fields completed
              </p>
              {missingCount > 0 && (
                <div className="text-xs">
                  <p className="font-medium text-amber-600">Missing {missingCount} fields:</p>
                  {Object.entries(getMissingFieldsByCategory()).map(([category, fields]) => (
                    <div key={category} className="mt-1">
                      <span className="capitalize font-medium">{category}:</span>
                      <span className="ml-1">{fields.join(', ')}</span>
                    </div>
                  ))}
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
          {completedFields.length}/{applicableFields.length} fields
        </span>
      </div>

      {showProgress && (
        <div className="space-y-2">
          <Progress value={completionPercentage} className="h-2" />
          {missingCount > 0 && (
            <div className="text-xs text-muted-foreground">
              Missing: {Object.entries(getMissingFieldsByCategory()).map(([category, fields]) => 
                `${category} (${fields.length})`
              ).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}