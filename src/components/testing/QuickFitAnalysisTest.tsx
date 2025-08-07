/**
 * Quick test component to verify Investment Fit Analysis is working correctly
 * Tests the critical "United States" → "United States" matching scenario
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateLocationMatchScore, calculateIndustryMatchScore } from '@/lib/financial-parser';

export function QuickFitAnalysisTest() {
  const [results, setResults] = useState<any[]>([]);

  const runQuickTest = () => {
    const quickTests = [
      {
        name: '🚨 CRITICAL: "United States" → "United States"',
        result: calculateLocationMatchScore(['United States'], 'United States'),
        expected: 100,
        type: 'CRITICAL EXACT MATCH'
      },
      {
        name: '"All Industries" → "Healthcare & Medical"',
        result: calculateIndustryMatchScore(['All Industries'], 'Healthcare & Medical'),
        expected: 100,
        type: 'ALL INDUSTRIES MATCH'
      },
      {
        name: '"United States" → "Southwest US"',
        result: calculateLocationMatchScore(['United States'], 'Southwest US'),
        expected: 100,
        type: 'HIERARCHICAL MATCH'
      },
      {
        name: '"Technology & Software" → "Technology & Software"',
        result: calculateIndustryMatchScore(['Technology & Software'], 'Technology & Software'),
        expected: 100,
        type: 'EXACT INDUSTRY MATCH'
      }
    ];

    setResults(quickTests);
  };

  const getStatus = (actual: number, expected: number) => {
    return actual === expected ? 'PASS' : 'FAIL';
  };

  const getStatusColor = (status: string) => {
    return status === 'PASS' 
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">🔍 Investment Fit Analysis - Quick Test</CardTitle>
        <Button onClick={runQuickTest} size="sm">
          Run Quick Validation
        </Button>
      </CardHeader>
      <CardContent>
        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((test, index) => {
              const status = getStatus(test.result, test.expected);
              return (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{test.name}</div>
                    <Badge className={getStatusColor(status)}>
                      {status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {test.type}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Expected: {test.expected}%</span>
                    <span className={status === 'PASS' ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                      Actual: {test.result}%
                    </span>
                  </div>
                </div>
              );
            })}
            
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="font-medium mb-1">Quick Test Summary</div>
              <div className="text-sm text-muted-foreground">
                {results.filter(t => getStatus(t.result, t.expected) === 'PASS').length} / {results.length} tests passing
              </div>
            </div>
          </div>
        )}
        
        {results.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Click "Run Quick Validation" to test critical matching scenarios
          </div>
        )}
      </CardContent>
    </Card>
  );
}