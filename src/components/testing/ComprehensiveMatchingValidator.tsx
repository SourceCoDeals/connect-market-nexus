/**
 * Comprehensive validation suite for Investment Fit Analysis matching logic
 * Tests location, industry, and revenue matching with real-world scenarios
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { calculateLocationMatchScore, calculateIndustryMatchScore } from '@/lib/financial-parser';

interface TestCase {
  name: string;
  type: 'location' | 'industry';
  userInput: string[];
  listingValue: string;
  expectedScore: number;
  actualScore: number;
  scenario: string;
}

export function ComprehensiveMatchingValidator() {
  const [testResults, setTestResults] = useState<TestCase[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runValidationSuite = async () => {
    setIsRunning(true);
    
    // Comprehensive test cases covering real-world scenarios
    const testCases: Omit<TestCase, 'actualScore'>[] = [
      // CRITICAL: Exact location matches that MUST return 100%
      {
        name: 'United States → United States (CRITICAL)',
        type: 'location',
        userInput: ['United States'],
        listingValue: 'United States',
        expectedScore: 100,
        scenario: 'User with "United States" preference should match "United States" listing perfectly'
      },
      {
        name: 'Northeast US → Northeast US',
        type: 'location',
        userInput: ['Northeast US'],
        listingValue: 'Northeast US',
        expectedScore: 100,
        scenario: 'Exact regional match'
      },
      
      // Hierarchical location matching
      {
        name: 'United States → Southwest US (Hierarchical)',
        type: 'location',
        userInput: ['United States'],
        listingValue: 'Southwest US',
        expectedScore: 100,
        scenario: 'Parent region should match sub-region'
      },
      {
        name: 'Southwest US → United States (Reverse Hierarchical)',
        type: 'location',
        userInput: ['Southwest US'],
        listingValue: 'United States',
        expectedScore: 100,
        scenario: 'Sub-region should match parent region'
      },
      
      // Regional proximity
      {
        name: 'Northeast US → Southeast US (Regional)',
        type: 'location',
        userInput: ['Northeast US'],
        listingValue: 'Southeast US',
        expectedScore: 75,
        scenario: 'Same country, different regions'
      },
      
      // Continental matching
      {
        name: 'United States → Canada (Continental)',
        type: 'location',
        userInput: ['United States'],
        listingValue: 'Canada',
        expectedScore: 50,
        scenario: 'Same continent, different countries'
      },
      
      // All Locations option
      {
        name: 'All Locations → Japan',
        type: 'location',
        userInput: ['All Locations'],
        listingValue: 'Japan',
        expectedScore: 100,
        scenario: 'All Locations should match anything'
      },
      
      // INDUSTRY MATCHING TESTS
      
      // Exact industry matches
      {
        name: 'Technology & Software → Technology & Software',
        type: 'industry',
        userInput: ['Technology & Software'],
        listingValue: 'Technology & Software',
        expectedScore: 100,
        scenario: 'Perfect industry match'
      },
      
      // All Industries option
      {
        name: 'All Industries → Healthcare & Medical',
        type: 'industry',
        userInput: ['All Industries'],
        listingValue: 'Healthcare & Medical',
        expectedScore: 100,
        scenario: 'All Industries should match any category'
      },
      {
        name: 'All Industries → Other',
        type: 'industry',
        userInput: ['All Industries'],
        listingValue: 'Other',
        expectedScore: 100,
        scenario: 'All Industries should even match "Other" category'
      },
      
      // Related industries (proximity matching)
      {
        name: 'Technology & Software → Telecommunications',
        type: 'industry',
        userInput: ['Technology & Software'],
        listingValue: 'Telecommunications',
        expectedScore: 80,
        scenario: 'Related technology industries should score highly'
      },
      {
        name: 'Healthcare & Medical → Pharmaceuticals',
        type: 'industry',
        userInput: ['Healthcare & Medical'],
        listingValue: 'Pharmaceuticals',
        expectedScore: 80,
        scenario: 'Related healthcare industries'
      },
      
      // Partial text matching
      {
        name: 'Technology → Technology & Software',
        type: 'industry',
        userInput: ['Technology'],
        listingValue: 'Technology & Software',
        expectedScore: 70,
        scenario: 'Partial keyword match should work'
      },
      
      // No match scenarios
      {
        name: 'Technology & Software → Agriculture & Farming',
        type: 'industry',
        userInput: ['Technology & Software'],
        listingValue: 'Agriculture & Farming',
        expectedScore: 0,
        scenario: 'Unrelated industries should not match'
      },
      
      // Multiple user categories
      {
        name: 'Multiple Categories → Match One',
        type: 'industry',
        userInput: ['Technology & Software', 'Healthcare & Medical'],
        listingValue: 'Healthcare & Medical',
        expectedScore: 100,
        scenario: 'Should match if any user category matches'
      },
      
      // Edge cases
      {
        name: 'Empty User Input',
        type: 'location',
        userInput: [],
        listingValue: 'United States',
        expectedScore: 0,
        scenario: 'Empty user preferences should return 0'
      },
      {
        name: 'Empty Listing Value',
        type: 'location',
        userInput: ['United States'],
        listingValue: '',
        expectedScore: 0,
        scenario: 'Empty listing location should return 0'
      }
    ];

    const results: TestCase[] = [];
    
    for (const testCase of testCases) {
      // Add small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 50));
      
      let actualScore: number;
      if (testCase.type === 'location') {
        actualScore = calculateLocationMatchScore(testCase.userInput, testCase.listingValue);
      } else {
        actualScore = calculateIndustryMatchScore(testCase.userInput, testCase.listingValue);
      }
      
      results.push({
        ...testCase,
        actualScore
      });
    }
    
    setTestResults(results);
    setIsRunning(false);
  };

  const getTestStatus = (actual: number, expected: number) => {
    if (actual === expected) return 'pass';
    if (Math.abs(actual - expected) <= 5) return 'warning'; // Within 5% tolerance
    return 'fail';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'fail': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getSummaryStats = () => {
    const total = testResults.length;
    const passed = testResults.filter(t => getTestStatus(t.actualScore, t.expectedScore) === 'pass').length;
    const warnings = testResults.filter(t => getTestStatus(t.actualScore, t.expectedScore) === 'warning').length;
    const failed = testResults.filter(t => getTestStatus(t.actualScore, t.expectedScore) === 'fail').length;
    
    return { total, passed, warnings, failed };
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl">Investment Fit Matching - Comprehensive Validation Suite</CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            onClick={runValidationSuite} 
            disabled={isRunning}
            className="text-sm"
          >
            {isRunning ? 'Running Tests...' : 'Run Comprehensive Validation'}
          </Button>
          {testResults.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-600 font-medium">
                ✓ {getSummaryStats().passed} Passed
              </span>
              <span className="text-yellow-600 font-medium">
                ⚠ {getSummaryStats().warnings} Warnings
              </span>
              <span className="text-red-600 font-medium">
                ✗ {getSummaryStats().failed} Failed
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {testResults.length > 0 && (
          <div className="space-y-6">
            {/* Critical Issues First */}
            {testResults.filter(t => t.name.includes('CRITICAL') && getTestStatus(t.actualScore, t.expectedScore) === 'fail').length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 dark:text-red-400 mb-2">🚨 CRITICAL FAILURES</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  These failures indicate fundamental bugs that will break the Investment Fit Analysis:
                </p>
                {testResults.filter(t => t.name.includes('CRITICAL') && getTestStatus(t.actualScore, t.expectedScore) === 'fail').map((test, index) => (
                  <div key={index} className="bg-white dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded p-3 mb-2">
                    <div className="font-medium text-red-800 dark:text-red-400">{test.name}</div>
                    <div className="text-sm text-red-600 dark:text-red-300">
                      Expected: {test.expectedScore}% | Actual: {test.actualScore}%
                    </div>
                    <div className="text-xs text-red-500 dark:text-red-400 mt-1">{test.scenario}</div>
                  </div>
                ))}
              </div>
            )}

            {/* All Test Results */}
            <div className="grid grid-cols-1 gap-4">
              {testResults.map((test, index) => {
                const status = getTestStatus(test.actualScore, test.expectedScore);
                const isCritical = test.name.includes('CRITICAL');
                
                return (
                  <div 
                    key={index} 
                    className={`border rounded-lg p-4 space-y-3 ${
                      isCritical && status === 'fail' 
                        ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10' 
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{test.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {test.type}
                        </Badge>
                        {isCritical && (
                          <Badge variant="destructive" className="text-xs">
                            CRITICAL
                          </Badge>
                        )}
                      </div>
                      <Badge className={getStatusColor(status)}>
                        {status.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground italic">
                      {test.scenario}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">User Input:</span>
                        <div className="font-mono text-xs mt-1 p-2 bg-muted rounded">
                          {JSON.stringify(test.userInput)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Listing Value:</span>
                        <div className="font-mono text-xs mt-1 p-2 bg-muted rounded">
                          "{test.listingValue}"
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expected:</span>
                        <div className="font-bold text-base mt-1">{test.expectedScore}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actual:</span>
                        <div className={`font-bold text-base mt-1 ${
                          status === 'pass' ? 'text-emerald-600' : 
                          status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {test.actualScore}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <Separator />
            
            {/* Summary Statistics */}
            <div className="bg-muted/30 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Validation Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">
                    {getSummaryStats().total}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Tests</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-600">
                    {getSummaryStats().passed}
                  </div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">
                    {getSummaryStats().warnings}
                  </div>
                  <div className="text-sm text-muted-foreground">Warnings</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {getSummaryStats().failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-muted-foreground">
                <strong>Success Rate:</strong> {Math.round((getSummaryStats().passed / getSummaryStats().total) * 100)}%
              </div>
            </div>
          </div>
        )}
        
        {isRunning && (
          <div className="text-center py-8">
            <div className="text-sm text-muted-foreground">Running comprehensive validation suite...</div>
          </div>
        )}
        
        {testResults.length === 0 && !isRunning && (
          <div className="text-center py-8">
            <div className="text-sm text-muted-foreground">
              Click "Run Comprehensive Validation" to test all matching logic scenarios
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}