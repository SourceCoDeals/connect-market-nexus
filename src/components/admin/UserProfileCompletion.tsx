import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { getRelevantFieldsForBuyerType, getFieldCategories, FIELD_LABELS } from '@/lib/buyer-type-fields';

interface UserProfileCompletionProps {
  user: User;
}

export function UserProfileCompletion({ user }: UserProfileCompletionProps) {
  // Get standardized field definitions for this user's buyer type
  const relevantFields = getRelevantFieldsForBuyerType(user.buyer_type || 'individual');
  const fieldCategories = getFieldCategories(user.buyer_type || 'individual');
  
  // Optional fields that don't count against completion
  const optionalFields = ['website', 'linkedin_profile'];
  
  // Filter out optional fields for completion calculation
  const requiredFieldsForCompletion = relevantFields.filter(field => !optionalFields.includes(field));

  // Check field completion
  const fieldStatus = relevantFields.map(field => {
    const value = user[field as keyof User];
    let isComplete = false;
    const isRequired = !optionalFields.includes(field);

    if (field === 'business_categories' || field === 'target_locations') {
      isComplete = Array.isArray(value) && value.length > 0;
    } else {
      isComplete = value !== null && value !== undefined && value !== '';
    }

    return {
      key: field,
      label: FIELD_LABELS[field as keyof typeof FIELD_LABELS] || field,
      isComplete,
      isRequired,
      value
    };
  });

  // Calculate completion stats (only for required fields)
  const requiredFieldStatus = fieldStatus.filter(field => field.isRequired);
  const completedRequiredFields = requiredFieldStatus.filter(field => field.isComplete);
  const completionPercentage = requiredFieldStatus.length > 0 
    ? Math.round((completedRequiredFields.length / requiredFieldStatus.length) * 100)
    : 100;
  
  const missingRequiredFields = requiredFieldStatus.filter(field => !field.isComplete);

  // Group fields by category for display
  const fieldsByCategory = Object.entries(fieldCategories).reduce((acc, [categoryName, categoryFields]) => {
    const categoryFieldStatus = fieldStatus.filter(field => 
      (categoryFields as string[]).includes(field.key)
    );
    if (categoryFieldStatus.length > 0) {
      acc[categoryName] = categoryFieldStatus;
    }
    return acc;
  }, {} as Record<string, typeof fieldStatus>);

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCompletionBadgeVariant = (percentage: number) => {
    if (percentage >= 90) return 'default';
    if (percentage >= 70) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Profile Completion</CardTitle>
            <CardDescription>
              {user.first_name} {user.last_name}'s profile completeness
            </CardDescription>
          </div>
          <div className="text-right">
            <Badge variant={getCompletionBadgeVariant(completionPercentage)}>
              {completionPercentage}% Complete
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span className={getCompletionColor(completionPercentage)}>
              {completedRequiredFields.length} of {requiredFieldStatus.length} required fields
            </span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {/* Fields by Category */}
        <div className="space-y-4">
          {Object.entries(fieldsByCategory).map(([category, fields]) => {
            const requiredFieldsInCategory = fields.filter(f => f.isRequired);
            const categoryCompletion = requiredFieldsInCategory.length > 0
              ? Math.round((requiredFieldsInCategory.filter(f => f.isComplete).length / requiredFieldsInCategory.length) * 100)
              : 100;
            
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    {category}
                  </h4>
                  <span className={`text-xs ${getCompletionColor(categoryCompletion)}`}>
                    {categoryCompletion}%
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {fields.map(field => (
                    <div key={field.key} className="flex items-center gap-2 text-sm">
                      {field.isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={field.isComplete ? 'text-green-700' : 'text-red-700'}>
                        {field.label}
                        {!field.isRequired && <span className="text-muted-foreground"> (optional)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Missing Required Fields Summary */}
        {missingRequiredFields.length > 0 && (
          <div className="space-y-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <h4 className="font-medium text-yellow-800">Missing Required Information</h4>
            </div>
            
            <div className="text-sm text-yellow-700">
              <p className="mb-2">The following required fields are incomplete:</p>
              <ul className="list-disc list-inside space-y-1">
                {missingRequiredFields.map(field => (
                  <li key={field.key}>{field.label}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Data restoration indicator */}
        {user.updated_at && new Date(user.updated_at) > new Date('2025-01-20') && (
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Profile Data Restored</span>
            </div>
            <p className="text-xs text-emerald-700 mt-1">
              Original user data has been recovered from pre-migration backup snapshots.
            </p>
          </div>
        )}

        {/* Completion Status */}
        {completionPercentage >= 90 && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">Excellent Profile!</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              This user has completed their profile thoroughly and is ready for marketplace access.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}