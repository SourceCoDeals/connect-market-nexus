import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Database, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ValidationResult {
  check: string;
  description: string;
  status: 'pass' | 'warning' | 'fail';
  details: string;
  count?: number;
  examples?: string[];
}

export function DataConsistencyValidator() {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const runValidation = async () => {
    setIsRunning(true);
    setResults([]);
    setProgress(0);

    const validationResults: ValidationResult[] = [];
    const totalChecks = 6;
    let completedChecks = 0;

    try {
      // Check 1: Profile business_categories format consistency
      setProgress((++completedChecks / totalChecks) * 100);
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, business_categories, target_locations')
          .not('business_categories', 'is', null);

        if (error) throw error;

        const invalidCategories = profiles?.filter(p => {
          try {
            if (typeof p.business_categories === 'string') {
              JSON.parse(p.business_categories);
            }
            return false;
          } catch {
            return true;
          }
        }) || [];

        validationResults.push({
          check: 'Profile Business Categories Format',
          description: 'Verify all business_categories are valid JSON arrays',
          status: invalidCategories.length === 0 ? 'pass' : 'warning',
          details: invalidCategories.length === 0 
            ? `All ${profiles?.length || 0} profiles have valid business_categories format`
            : `${invalidCategories.length} profiles have invalid business_categories format`,
          count: profiles?.length || 0,
          examples: invalidCategories.slice(0, 3).map(p => `Profile ${p.id}`)
        });
      } catch (error) {
        validationResults.push({
          check: 'Profile Business Categories Format',
          description: 'Verify all business_categories are valid JSON arrays',
          status: 'fail',
          details: `Error checking business categories: ${error}`,
        });
      }

      // Check 2: Target locations consistency
      setProgress((++completedChecks / totalChecks) * 100);
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, target_locations')
          .not('target_locations', 'is', null);

        if (error) throw error;

        const stringLocations = profiles?.filter(p => 
          typeof p.target_locations === 'string' && 
          p.target_locations !== '' &&
          !p.target_locations.startsWith('[')
        ) || [];

        validationResults.push({
          check: 'Profile Target Locations Format',
          description: 'Check if target_locations need array conversion',
          status: stringLocations.length === 0 ? 'pass' : 'warning',
          details: stringLocations.length === 0 
            ? `All ${profiles?.length || 0} profiles have consistent target_locations format`
            : `${stringLocations.length} profiles may need target_locations conversion`,
          count: profiles?.length || 0,
          examples: stringLocations.slice(0, 3).map(p => `${p.target_locations}`)
        });
      } catch (error) {
        validationResults.push({
          check: 'Profile Target Locations Format',
          description: 'Check if target_locations need array conversion',
          status: 'fail',
          details: `Error checking target locations: ${error}`,
        });
      }

      // Check 3: Listing categories standardization
      setProgress((++completedChecks / totalChecks) * 100);
      try {
        const { data: listings, error } = await supabase
          .from('listings')
          .select('id, category')
          .is('deleted_at', null);

        if (error) throw error;

        const standardCategories = [
          'Technology', 'Healthcare', 'Manufacturing', 'Retail', 'Professional Services',
          'Real Estate', 'Food & Beverage', 'Automotive', 'Construction', 'Financial Services',
          'Education', 'Entertainment', 'Transportation', 'Energy', 'Other'
        ];

        const nonStandardCategories = listings?.filter(l => 
          l.category && !standardCategories.includes(l.category)
        ) || [];

        validationResults.push({
          check: 'Listing Categories Standardization',
          description: 'Verify all listings use standardized category names',
          status: nonStandardCategories.length === 0 ? 'pass' : 'warning',
          details: nonStandardCategories.length === 0 
            ? `All ${listings?.length || 0} listings use standardized categories`
            : `${nonStandardCategories.length} listings use non-standard categories`,
          count: listings?.length || 0,
          examples: [...new Set(nonStandardCategories.slice(0, 3).map(l => l.category))]
        });
      } catch (error) {
        validationResults.push({
          check: 'Listing Categories Standardization',
          description: 'Verify all listings use standardized category names',
          status: 'fail',
          details: `Error checking listing categories: ${error}`,
        });
      }

      // Check 4: Profile completeness for matching
      setProgress((++completedChecks / totalChecks) * 100);
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, business_categories, target_locations, revenue_range_min, revenue_range_max, approval_status')
          .eq('approval_status', 'approved');

        if (error) throw error;

        const incompleteProfiles = profiles?.filter(p => {
          const hasCategories = p.business_categories && 
            (Array.isArray(p.business_categories) ? p.business_categories.length > 0 : p.business_categories !== '[]');
          const hasLocations = p.target_locations && p.target_locations !== '';
          const hasRevenue = p.revenue_range_min !== null || p.revenue_range_max !== null;
          
          return !hasCategories || !hasLocations;
        }) || [];

        validationResults.push({
          check: 'Profile Completeness for Matching',
          description: 'Check if approved users have sufficient data for investment matching',
          status: incompleteProfiles.length === 0 ? 'pass' : 'warning',
          details: incompleteProfiles.length === 0 
            ? `All ${profiles?.length || 0} approved profiles have complete matching data`
            : `${incompleteProfiles.length} approved profiles have incomplete matching data`,
          count: profiles?.length || 0,
          examples: incompleteProfiles.slice(0, 3).map(p => `Profile ${p.id}`)
        });
      } catch (error) {
        validationResults.push({
          check: 'Profile Completeness for Matching',
          description: 'Check if approved users have sufficient data for investment matching',
          status: 'fail',
          details: `Error checking profile completeness: ${error}`,
        });
      }

      // Check 5: Revenue data consistency
      setProgress((++completedChecks / totalChecks) * 100);
      try {
        const { data: listings, error } = await supabase
          .from('listings')
          .select('id, revenue, ebitda')
          .is('deleted_at', null);

        if (error) throw error;

        const inconsistentRevenue = listings?.filter(l => 
          (l.revenue && l.ebitda && Number(l.ebitda) > Number(l.revenue))
        ) || [];

        validationResults.push({
          check: 'Revenue Data Consistency',
          description: 'Verify EBITDA does not exceed revenue in listings',
          status: inconsistentRevenue.length === 0 ? 'pass' : 'warning',
          details: inconsistentRevenue.length === 0 
            ? `All ${listings?.length || 0} listings have consistent revenue data`
            : `${inconsistentRevenue.length} listings have EBITDA > revenue`,
          count: listings?.length || 0,
          examples: inconsistentRevenue.slice(0, 3).map(l => `Listing ${l.id}`)
        });
      } catch (error) {
        validationResults.push({
          check: 'Revenue Data Consistency',
          description: 'Verify EBITDA does not exceed revenue in listings',
          status: 'fail',
          details: `Error checking revenue consistency: ${error}`,
        });
      }

      // Check 6: Investment fit score calculation validity
      setProgress((++completedChecks / totalChecks) * 100);
      try {
        // Test with sample data to ensure functions work
        const testCategories = ["Technology", "Healthcare"];
        const testLocations = ["United States", "California"];
        
        // Import and test the functions
        const { calculateLocationMatchScore, calculateIndustryMatchScore } = await import('@/lib/financial-parser');
        
        const locationScore = calculateLocationMatchScore(testLocations, "United States");
        const industryScore = calculateIndustryMatchScore(testCategories, "Technology");
        
        const isValid = locationScore >= 0 && locationScore <= 100 && 
                       industryScore >= 0 && industryScore <= 100;

        validationResults.push({
          check: 'Investment Fit Calculation Validity',
          description: 'Test that matching algorithms return valid scores (0-100)',
          status: isValid ? 'pass' : 'fail',
          details: isValid 
            ? `Matching algorithms return valid scores (Location: ${locationScore}%, Industry: ${industryScore}%)`
            : `Matching algorithms return invalid scores (Location: ${locationScore}%, Industry: ${industryScore}%)`,
        });
      } catch (error) {
        validationResults.push({
          check: 'Investment Fit Calculation Validity',
          description: 'Test that matching algorithms return valid scores (0-100)',
          status: 'fail',
          details: `Error testing matching algorithms: ${error}`,
        });
      }

    } catch (error) {
      console.error('Validation error:', error);
    }

    setResults(validationResults);
    setProgress(100);
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'fail': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const summary = results.length > 0 ? {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    warnings: results.filter(r => r.status === 'warning').length,
    failed: results.filter(r => r.status === 'fail').length,
  } : null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Consistency Validation Suite
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Validate data consistency and format across profiles and listings
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            onClick={runValidation} 
            disabled={isRunning}
            className="min-w-[120px]"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              'Run Data Validation'
            )}
          </Button>
          {isRunning && (
            <div className="flex-1">
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(progress)}% complete
              </p>
            </div>
          )}
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{summary.total}</div>
              <div className="text-sm text-muted-foreground">Total Checks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
              <div className="text-sm text-muted-foreground">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.warnings}</div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Validation Results</h3>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="p-4 border rounded-lg bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <h4 className="font-medium">{result.check}</h4>
                    </div>
                    <Badge className={getStatusColor(result.status)}>
                      {result.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">{result.description}</p>
                  <p className="text-sm mb-2">{result.details}</p>
                  
                  {result.count !== undefined && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Records checked: {result.count}
                    </p>
                  )}
                  
                  {result.examples && result.examples.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Examples:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.examples.map((example, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {example}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!isRunning && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Run Data Validation" to check data consistency across the platform
          </div>
        )}
      </CardContent>
    </Card>
  );
}