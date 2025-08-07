import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { calculateLocationMatchScore, calculateIndustryMatchScore } from '@/lib/financial-parser';

interface PerformanceTest {
  name: string;
  description: string;
  iterations: number;
  testFunction: () => void;
}

interface TestResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  status: 'success' | 'warning' | 'error';
}

export function PerformanceTestSuite() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const performanceTests: PerformanceTest[] = [
    {
      name: 'Location Matching Performance',
      description: 'Test location matching with various input combinations',
      iterations: 1000,
      testFunction: () => {
        const userLocations = ["United States", "Southwest US", "California"];
        const listingLocation = "United States";
        calculateLocationMatchScore(userLocations, listingLocation);
      }
    },
    {
      name: 'Industry Matching Performance',
      description: 'Test industry matching with large category arrays',
      iterations: 1000,
      testFunction: () => {
        const userCategories = ["Technology", "Healthcare", "Professional Services"];
        const listingCategory = "Technology";
        calculateIndustryMatchScore(userCategories, listingCategory);
      }
    },
    {
      name: 'Complex Location Hierarchies',
      description: 'Test deeply nested location hierarchies',
      iterations: 500,
      testFunction: () => {
        const userLocations = ["North America", "United States", "West Coast", "California", "San Francisco Bay Area"];
        const listingLocation = "San Francisco";
        calculateLocationMatchScore(userLocations, listingLocation);
      }
    },
    {
      name: 'All Industries Matching',
      description: 'Test "All Industries" matching performance',
      iterations: 1000,
      testFunction: () => {
        const userCategories = ["All Industries"];
        const listingCategory = "Technology";
        calculateIndustryMatchScore(userCategories, listingCategory);
      }
    }
  ];

  const runPerformanceTests = async () => {
    setIsRunning(true);
    setResults([]);
    setProgress(0);

    const testResults: TestResult[] = [];

    for (let i = 0; i < performanceTests.length; i++) {
      const test = performanceTests[i];
      const times: number[] = [];

      // Warm up
      for (let w = 0; w < 10; w++) {
        test.testFunction();
      }

      // Actual test runs
      for (let j = 0; j < test.iterations; j++) {
        const startTime = performance.now();
        test.testFunction();
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const totalTime = times.reduce((sum, time) => sum + time, 0);
      const avgTime = totalTime / test.iterations;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      const status: 'success' | 'warning' | 'error' = 
        avgTime < 1 ? 'success' : 
        avgTime < 5 ? 'warning' : 'error';

      testResults.push({
        name: test.name,
        iterations: test.iterations,
        totalTime,
        avgTime,
        minTime,
        maxTime,
        status
      });

      setProgress(((i + 1) / performanceTests.length) * 100);
      setResults([...testResults]);

      // Small delay to update UI
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Investment Fit Analysis - Performance Test Suite
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Test the performance of location and industry matching algorithms
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            onClick={runPerformanceTests} 
            disabled={isRunning}
            className="min-w-[120px]"
          >
            {isRunning ? 'Running...' : 'Run Performance Tests'}
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

        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Performance Results</h3>
            <div className="grid gap-4">
              {results.map((result, index) => (
                <div key={index} className="p-4 border rounded-lg bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <h4 className="font-medium">{result.name}</h4>
                    </div>
                    <Badge className={getStatusColor(result.status)}>
                      {result.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Iterations</p>
                      <p className="font-semibold">{result.iterations.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Time</p>
                      <p className="font-semibold">{result.avgTime.toFixed(3)}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min Time</p>
                      <p className="font-semibold">{result.minTime.toFixed(3)}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max Time</p>
                      <p className="font-semibold">{result.maxTime.toFixed(3)}ms</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Total test time: {result.totalTime.toFixed(2)}ms
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold mb-2">Performance Guidelines</h4>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Excellent: &lt; 1ms per operation</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  <span>Acceptable: 1-5ms per operation</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-red-500" />
                  <span>Needs optimization: &gt; 5ms per operation</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isRunning && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Run Performance Tests" to start the performance validation suite
          </div>
        )}
      </CardContent>
    </Card>
  );
}