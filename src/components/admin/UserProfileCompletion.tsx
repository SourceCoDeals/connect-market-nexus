import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User } from '@/types';
import { CheckCircle2, AlertCircle, Mail, Phone, Building2, Globe, Linkedin } from 'lucide-react';

interface UserProfileCompletionProps {
  user: User;
  onSendReminder?: (user: User) => void;
}

export function UserProfileCompletion({ user, onSendReminder }: UserProfileCompletionProps) {
  // Define required fields and their descriptions
  const requiredFields = [
    { key: 'first_name', label: 'First Name', icon: CheckCircle2, category: 'basic' },
    { key: 'last_name', label: 'Last Name', icon: CheckCircle2, category: 'basic' },
    { key: 'email', label: 'Email', icon: Mail, category: 'basic' },
    { key: 'phone_number', label: 'Phone Number', icon: Phone, category: 'contact' },
    { key: 'company', label: 'Company', icon: Building2, category: 'business' },
    { key: 'website', label: 'Website', icon: Globe, category: 'contact' },
    { key: 'linkedin_profile', label: 'LinkedIn Profile', icon: Linkedin, category: 'contact' },
    { key: 'ideal_target_description', label: 'Ideal Target Description', icon: CheckCircle2, category: 'profile' },
    { key: 'business_categories', label: 'Business Categories', icon: CheckCircle2, category: 'profile' },
    { key: 'target_locations', label: 'Target Locations', icon: CheckCircle2, category: 'profile' },
  ];

  // Buyer-type specific fields
  const buyerSpecificFields = {
    corporate: [
      { key: 'estimated_revenue', label: 'Estimated Revenue', icon: CheckCircle2, category: 'financial' }
    ],
    privateEquity: [
      { key: 'fund_size', label: 'Fund Size', icon: CheckCircle2, category: 'financial' },
      { key: 'investment_size', label: 'Investment Size', icon: CheckCircle2, category: 'financial' }
    ],
    familyOffice: [
      { key: 'fund_size', label: 'Fund Size', icon: CheckCircle2, category: 'financial' },
      { key: 'aum', label: 'Assets Under Management', icon: CheckCircle2, category: 'financial' }
    ],
    searchFund: [
      { key: 'is_funded', label: 'Funding Status', icon: CheckCircle2, category: 'financial' },
      { key: 'target_company_size', label: 'Target Company Size', icon: CheckCircle2, category: 'financial' }
    ],
    individual: [
      { key: 'funding_source', label: 'Funding Source', icon: CheckCircle2, category: 'financial' }
    ]
  };

  // Get all applicable fields for this user
  const allFields = [
    ...requiredFields,
    ...(buyerSpecificFields[user.buyer_type as keyof typeof buyerSpecificFields] || [])
  ];

  // Check field completion
  const fieldStatus = allFields.map(field => {
    const value = user[field.key as keyof User];
    let isComplete = false;

    if (field.key === 'business_categories') {
      isComplete = Array.isArray(value) && value.length > 0;
    } else {
      isComplete = value !== null && value !== undefined && value !== '';
    }

    return {
      ...field,
      isComplete,
      value
    };
  });

  // Calculate completion stats
  const completedFields = fieldStatus.filter(field => field.isComplete);
  const completionPercentage = Math.round((completedFields.length / allFields.length) * 100);
  const missingFields = fieldStatus.filter(field => !field.isComplete);

  // Group fields by category
  const fieldsByCategory = fieldStatus.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
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
              {completedFields.length} of {allFields.length} fields
            </span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {/* Fields by Category */}
        <div className="space-y-4">
          {Object.entries(fieldsByCategory).map(([category, fields]) => {
            const categoryCompletion = Math.round(
              (fields.filter(f => f.isComplete).length / fields.length) * 100
            );
            
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium capitalize">
                    {category.replace(/([A-Z])/g, ' $1').trim()} Information
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
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Missing Fields Summary */}
        {missingFields.length > 0 && (
          <div className="space-y-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <h4 className="font-medium text-yellow-800">Missing Information</h4>
            </div>
            
            <div className="text-sm text-yellow-700">
              <p className="mb-2">The following fields are incomplete:</p>
              <ul className="list-disc list-inside space-y-1">
                {missingFields.map(field => (
                  <li key={field.key}>{field.label}</li>
                ))}
              </ul>
            </div>

            {onSendReminder && completionPercentage < 80 && (
              <Button 
                onClick={() => onSendReminder(user)}
                size="sm"
                variant="outline"
                className="mt-3"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Completion Reminder
              </Button>
            )}
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