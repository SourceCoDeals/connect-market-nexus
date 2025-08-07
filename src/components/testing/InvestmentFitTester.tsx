/**
 * Testing component to validate Investment Fit Analysis implementation
 * This helps verify that the matching algorithms work correctly
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { calculateLocationMatchScore, calculateIndustryMatchScore } from '@/lib/financial-parser';
import { Separator } from '@/components/ui/separator';

export function InvestmentFitTester() {
  const [testResults, setTestResults] = useState<any[]>([]);

  const runTests = () => {
    const tests = [
      // Location matching tests
      {
        name: 'Exact Location Match',
        type: 'location',
        userInput: ['United States'],
        listingValue: 'United States',
        expectedScore: 100,
        actualScore: calculateLocationMatchScore(['United States'], 'United States')
      },
      {
        name: 'Hierarchical Match (Parent -> Sub)',
        type: 'location',
        userInput: ['United States'],
        listingValue: 'Southwest US',
        expectedScore: 100,
        actualScore: calculateLocationMatchScore(['United States'], 'Southwest US')
      },
      {
        name: 'Hierarchical Match (Sub -> Parent)',
        type: 'location',
        userInput: ['Southwest US'],
        listingValue: 'United States',
        expectedScore: 100,
        actualScore: calculateLocationMatchScore(['Southwest US'], 'United States')
      },
      {
        name: 'Regional Match (Same Parent)',
        type: 'location',
        userInput: ['Northeast US'],
        listingValue: 'Southeast US',
        expectedScore: 75,
        actualScore: calculateLocationMatchScore(['Northeast US'], 'Southeast US')
      },
      {
        name: 'Continental Match',
        type: 'location',
        userInput: ['United States'],
        listingValue: 'Canada',
        expectedScore: 50,
        actualScore: calculateLocationMatchScore(['United States'], 'Canada')
      },
      {
        name: 'All Locations Match',
        type: 'location',
        userInput: ['All Locations'],
        listingValue: 'Japan',
        expectedScore: 100,
        actualScore: calculateLocationMatchScore(['All Locations'], 'Japan')
      },
      // Industry matching tests
      {
        name: 'Exact Industry Match',
        type: 'industry',
        userInput: ['Technology & Software'],
        listingValue: 'Technology & Software',
        expectedScore: 100,
        actualScore: calculateIndustryMatchScore(['Technology & Software'], 'Technology & Software')
      },
      {
        name: 'All Industries Match',
        type: 'industry',
        userInput: ['All Industries'],
        listingValue: 'Healthcare & Medical',
        expectedScore: 100,
        actualScore: calculateIndustryMatchScore(['All Industries'], 'Healthcare & Medical')
      },
      {
        name: 'All Industries with Other',
        type: 'industry',
        userInput: ['All Industries'],
        listingValue: 'Other',
        expectedScore: 100,
        actualScore: calculateIndustryMatchScore(['All Industries'], 'Other')
      },
      {
        name: 'Related Industries',
        type: 'industry',
        userInput: ['Technology & Software'],
        listingValue: 'Telecommunications',
        expectedScore: 80,
        actualScore: calculateIndustryMatchScore(['Technology & Software'], 'Telecommunications')
      },
      {
        name: 'Partial Text Match',
        type: 'industry',
        userInput: ['Technology'],
        listingValue: 'Technology & Software',
        expectedScore: 70,
        actualScore: calculateIndustryMatchScore(['Technology'], 'Technology & Software')
      }
    ];

    setTestResults(tests);
  };

  const getTestStatus = (actual: number, expected: number) => {
    if (actual === expected) return 'pass';
    if (Math.abs(actual - expected) <= 5) return 'warning'; // Within 5% tolerance
    return 'fail';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-emerald-100 text-emerald-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'fail': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Investment Fit Analysis - Test Suite</CardTitle>
        <Button onClick={runTests}>Run All Tests</Button>
      </CardHeader>
      <CardContent>
        {testResults.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {testResults.map((test, index) => {
                const status = getTestStatus(test.actualScore, test.expectedScore);
                return (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{test.name}</h4>
                      <Badge className={getStatusColor(status)}>
                        {status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">User Input:</span>
                        <div className="font-mono">{JSON.stringify(test.userInput)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Listing Value:</span>
                        <div className="font-mono">"{test.listingValue}"</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expected Score:</span>
                        <div className="font-bold">{test.expectedScore}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actual Score:</span>
                        <div className={`font-bold ${
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
            
            <div className="flex justify-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {testResults.filter(t => getTestStatus(t.actualScore, t.expectedScore) === 'pass').length}
                </div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {testResults.filter(t => getTestStatus(t.actualScore, t.expectedScore) === 'warning').length}
                </div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {testResults.filter(t => getTestStatus(t.actualScore, t.expectedScore) === 'fail').length}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}