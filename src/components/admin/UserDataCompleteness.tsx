import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User } from '@/types';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface UserDataCompletenessProps {
  user: User;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function UserDataCompleteness({ user, showProgress = false, size = 'md' }: UserDataCompletenessProps) {
  // All possible profile fields
  const allProfileFields = [
    // Basic Information
    { key: 'first_name', label: 'First Name', category: 'basic' },
    { key: 'last_name', label: 'Last Name', category: 'basic' },
    { key: 'email', label: 'Email', category: 'basic' },
    { key: 'phone_number', label: 'Phone', category: 'contact' },
    { key: 'company', label: 'Company', category: 'business' },
    { key: 'website', label: 'Website', category: 'contact' },
    { key: 'linkedin_profile', label: 'LinkedIn', category: 'contact' },
    
    // Business Profile
    { key: 'ideal_target_description', label: 'Target Description', category: 'profile' },
    { key: 'business_categories', label: 'Business Categories', category: 'profile' },
    { key: 'target_locations', label: 'Target Locations', category: 'profile' },
    { key: 'specific_business_search', label: 'Specific Search', category: 'profile' },
    { key: 'revenue_range_min', label: 'Min Revenue', category: 'profile' },
    { key: 'revenue_range_max', label: 'Max Revenue', category: 'profile' },
    
    // Buyer-specific fields (all possible)
    { key: 'estimated_revenue', label: 'Est. Revenue', category: 'financial', buyerTypes: ['corporate'] },
    { key: 'fund_size', label: 'Fund Size', category: 'financial', buyerTypes: ['privateEquity', 'familyOffice'] },
    { key: 'investment_size', label: 'Investment Size', category: 'financial', buyerTypes: ['privateEquity'] },
    { key: 'aum', label: 'AUM', category: 'financial', buyerTypes: ['familyOffice'] },
    { key: 'is_funded', label: 'Funding Status', category: 'financial', buyerTypes: ['searchFund'] },
    { key: 'funded_by', label: 'Funded By', category: 'financial', buyerTypes: ['searchFund'] },
    { key: 'target_company_size', label: 'Target Size', category: 'financial', buyerTypes: ['searchFund'] },
    { key: 'funding_source', label: 'Funding Source', category: 'financial', buyerTypes: ['individual'] },
    { key: 'needs_loan', label: 'Needs Loan', category: 'financial', buyerTypes: ['individual'] },
  ];

  // Get applicable fields for this user's buyer type
  const applicableFields = allProfileFields.filter(field => 
    !field.buyerTypes || field.buyerTypes.includes(user.buyer_type || 'corporate')
  );

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
            <Badge variant={variant} className="cursor-help">
              <Icon className="h-3 w-3 mr-1" />
              {completionPercentage}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <p className="font-medium">Profile Completion: {completionPercentage}%</p>
              <p className="text-xs">
                {completedFields.length} of {applicableFields.length} fields completed
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