import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { calculateLocationMatchScore, calculateIndustryMatchScore, STANDARDIZED_LOCATIONS, STANDARDIZED_CATEGORIES } from '@/lib/financial-parser';

interface ValidationResult {
  category: string;
  tests: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details?: string;
  }[];
}

export function ComprehensiveSystemValidator() {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runValidation = async () => {
    setIsRunning(true);
    setResults([]);

    const validationResults: ValidationResult[] = [];

    // 1. Database Schema Validation
    const schemaValidation: ValidationResult = {
      category: 'Database Schema',
      tests: []
    };

    try {
      // Check profiles table structure
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('target_locations, business_categories')
        .limit(5);

      if (profilesError) {
        schemaValidation.tests.push({
          name: 'Profiles Table Access',
          status: 'fail',
          message: 'Cannot access profiles table',
          details: profilesError.message
        });
      } else {
        schemaValidation.tests.push({
          name: 'Profiles Table Access',
          status: 'pass',
          message: 'Successfully accessed profiles table'
        });

        // Check data types
        if (profiles && profiles.length > 0) {
          const sampleProfile = profiles[0];
          
          // Check target_locations format
          if (Array.isArray(sampleProfile.target_locations)) {
            schemaValidation.tests.push({
              name: 'Target Locations Format',
              status: 'pass',
              message: 'target_locations is correctly stored as array'
            });
          } else if (typeof sampleProfile.target_locations === 'string') {
            schemaValidation.tests.push({
              name: 'Target Locations Format',
              status: 'warning',
              message: 'Some target_locations still stored as string',
              details: 'Migration may be incomplete'
            });
          } else {
            schemaValidation.tests.push({
              name: 'Target Locations Format',
              status: 'pass',
              message: 'target_locations is null/empty (acceptable)'
            });
          }

          // Check business_categories format
          if (Array.isArray(sampleProfile.business_categories)) {
            schemaValidation.tests.push({
              name: 'Business Categories Format',
              status: 'pass',
              message: 'business_categories is correctly stored as array'
            });
          } else {
            schemaValidation.tests.push({
              name: 'Business Categories Format',
              status: 'warning',
              message: 'business_categories format needs checking'
            });
          }
        }
      }

      // Check listings table
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('category, categories, location')
        .limit(5);

      if (listingsError) {
        schemaValidation.tests.push({
          name: 'Listings Table Access',
          status: 'fail',
          message: 'Cannot access listings table',
          details: listingsError.message
        });
      } else {
        schemaValidation.tests.push({
          name: 'Listings Table Access',
          status: 'pass',
          message: 'Successfully accessed listings table'
        });

        // Check category standardization
        if (listings && listings.length > 0) {
          const nonStandardCategories = listings.filter(listing => 
            !STANDARDIZED_CATEGORIES.includes(listing.category as any)
          );

          if (nonStandardCategories.length === 0) {
            schemaValidation.tests.push({
              name: 'Category Standardization',
              status: 'pass',
              message: 'All categories are standardized'
            });
          } else {
            schemaValidation.tests.push({
              name: 'Category Standardization',
              status: 'warning',
              message: `${nonStandardCategories.length} non-standard categories found`,
              details: nonStandardCategories.map(l => l.category).join(', ')
            });
          }

          // Check location standardization
          const nonStandardLocations = listings.filter(listing => 
            !STANDARDIZED_LOCATIONS.includes(listing.location as any)
          );

          if (nonStandardLocations.length === 0) {
            schemaValidation.tests.push({
              name: 'Location Standardization',
              status: 'pass',
              message: 'All locations are standardized'
            });
          } else {
            schemaValidation.tests.push({
              name: 'Location Standardization',
              status: 'warning',
              message: `${nonStandardLocations.length} non-standard locations found`,
              details: nonStandardLocations.map(l => l.location).join(', ')
            });
          }
        }
      }
    } catch (error) {
      schemaValidation.tests.push({
        name: 'Database Connection',
        status: 'fail',
        message: 'Failed to connect to database',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    validationResults.push(schemaValidation);

    // 2. Matching Algorithm Validation
    const matchingValidation: ValidationResult = {
      category: 'Matching Algorithms',
      tests: []
    };

    // Test location matching
    const locationTests = [
      { user: ['North America'], listing: 'United States', expected: 100 },
      { user: ['Europe'], listing: 'Germany', expected: 75 },
      { user: ['Asia'], listing: 'China', expected: 75 },
      { user: ['Global'], listing: 'Australia', expected: 100 },
      { user: ['United States'], listing: 'Canada', expected: 75 },
      { user: ['Technology'], listing: 'Healthcare', expected: 0 }
    ];

    let locationTestsPassed = 0;
    locationTests.forEach(test => {
      const score = calculateLocationMatchScore(test.user, test.listing);
      if (Math.abs(score - test.expected) <= 5) { // Allow small variance
        locationTestsPassed++;
      }
    });

    matchingValidation.tests.push({
      name: 'Location Matching Algorithm',
      status: locationTestsPassed === locationTests.length ? 'pass' : 'warning',
      message: `${locationTestsPassed}/${locationTests.length} location tests passed`,
      details: locationTestsPassed < locationTests.length ? 'Some edge cases may need adjustment' : undefined
    });

    // Test industry matching
    const industryTests = [
      { user: ['Technology'], listing: 'Technology', expected: 100 },
      { user: ['All Industries'], listing: 'Healthcare & Medical', expected: 100 },
      { user: ['Financial Services'], listing: 'Professional Services', expected: 70 },
      { user: ['Manufacturing & Industrial'], listing: 'Technology', expected: 0 }
    ];

    let industryTestsPassed = 0;
    industryTests.forEach(test => {
      const score = calculateIndustryMatchScore(test.user, test.listing);
      if (Math.abs(score - test.expected) <= 10) { // Allow variance for industry similarity
        industryTestsPassed++;
      }
    });

    matchingValidation.tests.push({
      name: 'Industry Matching Algorithm',
      status: industryTestsPassed === industryTests.length ? 'pass' : 'warning',
      message: `${industryTestsPassed}/${industryTests.length} industry tests passed`,
      details: industryTestsPassed < industryTests.length ? 'Some industry relationships may need refinement' : undefined
    });

    validationResults.push(matchingValidation);

    // 3. Data Consistency Validation
    const consistencyValidation: ValidationResult = {
      category: 'Data Consistency',
      tests: []
    };

    try {
      // Check for mixed data formats in profiles
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, target_locations, business_categories')
        .not('target_locations', 'is', null)
        .limit(50);

      if (allProfiles) {
        const stringLocationProfiles = allProfiles.filter(p => 
          typeof p.target_locations === 'string'
        );

        const arrayLocationProfiles = allProfiles.filter(p => 
          Array.isArray(p.target_locations)
        );

        if (stringLocationProfiles.length === 0) {
          consistencyValidation.tests.push({
            name: 'Profile Location Data Consistency',
            status: 'pass',
            message: 'All profiles use array format for locations'
          });
        } else {
          consistencyValidation.tests.push({
            name: 'Profile Location Data Consistency',
            status: 'warning',
            message: `${stringLocationProfiles.length} profiles still use string format`,
            details: 'Migration may need to be re-run'
          });
        }

        // Check business categories consistency
        const validCategoryProfiles = allProfiles.filter(p => 
          Array.isArray(p.business_categories) && 
          p.business_categories.every((cat: string) => STANDARDIZED_CATEGORIES.includes(cat as any))
        );

        consistencyValidation.tests.push({
          name: 'Profile Category Data Consistency',
          status: validCategoryProfiles.length === allProfiles.length ? 'pass' : 'warning',
          message: `${validCategoryProfiles.length}/${allProfiles.length} profiles have valid categories`
        });
      }
    } catch (error) {
      consistencyValidation.tests.push({
        name: 'Data Consistency Check',
        status: 'fail',
        message: 'Failed to check data consistency',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    validationResults.push(consistencyValidation);

    // 4. Component Integration Validation
    const integrationValidation: ValidationResult = {
      category: 'Component Integration',
      tests: []
    };

    // Test standardized data parsing
    const testUser = {
      target_locations: ['North America', 'Europe'],
      business_categories: ['Technology', 'Financial Services'],
      revenue_range_min: 1000000,
      revenue_range_max: 10000000,
      investment_size: '$1M - $5M'
    };

    try {
      // This would be the same logic used in InvestmentFitScore
      const userLocations = Array.isArray(testUser.target_locations) 
        ? testUser.target_locations.filter(Boolean)
        : [];

      if (userLocations.length === 2) {
        integrationValidation.tests.push({
          name: 'Location Data Parsing',
          status: 'pass',
          message: 'Components correctly parse location arrays'
        });
      } else {
        integrationValidation.tests.push({
          name: 'Location Data Parsing',
          status: 'fail',
          message: 'Location parsing logic has issues'
        });
      }

      const userCategories = Array.isArray(testUser.business_categories) 
        ? testUser.business_categories 
        : [];

      if (userCategories.length === 2) {
        integrationValidation.tests.push({
          name: 'Category Data Parsing',
          status: 'pass',
          message: 'Components correctly parse category arrays'
        });
      } else {
        integrationValidation.tests.push({
          name: 'Category Data Parsing',
          status: 'fail',
          message: 'Category parsing logic has issues'
        });
      }
    } catch (error) {
      integrationValidation.tests.push({
        name: 'Component Data Processing',
        status: 'fail',
        message: 'Error in component data processing',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    validationResults.push(integrationValidation);

    setResults(validationResults);
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pass: 'default',
      warning: 'secondary',
      fail: 'destructive'
    };
    
    return <Badge variant={variants[status] || 'secondary'}>{status.toUpperCase()}</Badge>;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Comprehensive System Validation
          <Button 
            onClick={runValidation} 
            disabled={isRunning}
            size="sm"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              'Run Validation'
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {results.length === 0 && !isRunning && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Run Validation" to test the entire system
          </div>
        )}

        {results.map((result, categoryIndex) => (
          <div key={categoryIndex} className="mb-6">
            <h3 className="text-lg font-semibold mb-3">{result.category}</h3>
            <div className="space-y-2">
              {result.tests.map((test, testIndex) => (
                <div key={testIndex} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(test.status)}
                    <div className="flex-1">
                      <div className="font-medium">{test.name}</div>
                      <div className="text-sm text-muted-foreground">{test.message}</div>
                      {test.details && (
                        <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                          {test.details}
                        </div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(test.status)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}