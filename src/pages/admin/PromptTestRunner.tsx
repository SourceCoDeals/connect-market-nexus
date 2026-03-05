/**
 * PromptTestRunner — In-app test runner for lead memo and teaser prompts.
 *
 * Two teaser test scenarios:
 * 1. TEASER_TEST_FULL — full-featured lead memo with all sections populated
 * 2. TEASER_TEST_BUYERS — lead memo that mentions buyers/competitors by name
 *
 * Each scenario invokes the generate-teaser edge function and validates the result.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Loader2, CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ─── Test Scenarios ────────────────────────────────────────────────

interface TeaserTestScenario {
  id: string;
  name: string;
  description: string;
  dealId: string;
  projectName: string;
}

const TEASER_TEST_FULL: TeaserTestScenario = {
  id: 'teaser-full',
  name: 'Full-featured lead memo',
  description:
    'Tests teaser generation from a lead memo with all sections populated. Expects zero anonymity breaches and proper section structure.',
  dealId: '', // set by user
  projectName: 'Project Alpha',
};

const TEASER_TEST_BUYERS: TeaserTestScenario = {
  id: 'teaser-buyers',
  name: 'Lead memo with buyer/competitor names',
  description:
    'Tests that buyer and competitor names from the lead memo are anonymized in the teaser output.',
  dealId: '', // set by user
  projectName: 'Project Beta',
};

const SCENARIOS = [TEASER_TEST_FULL, TEASER_TEST_BUYERS];

// ─── Result type ───────────────────────────────────────────────────

interface TestResult {
  scenarioId: string;
  status: 'pending' | 'running' | 'pass' | 'warn' | 'fail';
  validation?: { pass: boolean; errors: string[]; warnings: string[] };
  durationMs?: number;
  error?: string;
}

// ─── Component ─────────────────────────────────────────────────────

export default function PromptTestRunner() {
  const [dealId, setDealId] = useState('');
  const [results, setResults] = useState<TestResult[]>(
    SCENARIOS.map((s) => ({ scenarioId: s.id, status: 'pending' })),
  );
  const [running, setRunning] = useState(false);

  const runScenario = useCallback(
    async (scenario: TeaserTestScenario, index: number) => {
      setResults((prev) => {
        const next = [...prev];
        next[index] = { scenarioId: scenario.id, status: 'running' };
        return next;
      });

      const start = performance.now();
      try {
        const response = await supabase.functions.invoke('generate-teaser', {
          body: {
            deal_id: dealId,
            project_name: scenario.projectName,
          },
        });

        const durationMs = Math.round(performance.now() - start);

        if (response.error) {
          setResults((prev) => {
            const next = [...prev];
            next[index] = {
              scenarioId: scenario.id,
              status: 'fail',
              error: response.error.message,
              durationMs,
            };
            return next;
          });
          return;
        }

        const data = response.data as {
          validation?: { pass: boolean; errors: string[]; warnings: string[] };
        } | null;
        const validation = data?.validation;

        let status: TestResult['status'] = 'pass';
        if (validation && !validation.pass) status = 'fail';
        else if (validation && validation.warnings?.length > 0) status = 'warn';

        setResults((prev) => {
          const next = [...prev];
          next[index] = { scenarioId: scenario.id, status, validation, durationMs };
          return next;
        });
      } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        setResults((prev) => {
          const next = [...prev];
          next[index] = {
            scenarioId: scenario.id,
            status: 'fail',
            error: err instanceof Error ? err.message : String(err),
            durationMs,
          };
          return next;
        });
      }
    },
    [dealId],
  );

  const runAll = useCallback(async () => {
    if (!dealId) return;
    setRunning(true);
    setResults(SCENARIOS.map((s) => ({ scenarioId: s.id, status: 'pending' })));

    for (let i = 0; i < SCENARIOS.length; i++) {
      await runScenario(SCENARIOS[i], i);
    }
    setRunning(false);
  }, [dealId, runScenario]);

  const statusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Prompt Test Runner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Deal ID (must have a published lead memo)
              </label>
              <Input
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                placeholder="paste deal UUID"
              />
            </div>
            <Button onClick={runAll} disabled={running || !dealId}>
              {running ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run All
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Runs the generate-teaser edge function against the given deal and validates the output
            for anonymity breaches, section structure, and banned language.
          </p>
        </CardContent>
      </Card>

      {SCENARIOS.map((scenario, i) => {
        const result = results[i];
        return (
          <Card key={scenario.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  {statusIcon(result.status)}
                  {scenario.name}
                  {result.durationMs != null && (
                    <span className="text-xs text-muted-foreground font-normal">
                      {result.durationMs}ms
                    </span>
                  )}
                </CardTitle>
                <Badge
                  variant="secondary"
                  className={
                    result.status === 'pass'
                      ? 'bg-green-100 text-green-800'
                      : result.status === 'warn'
                        ? 'bg-amber-100 text-amber-800'
                        : result.status === 'fail'
                          ? 'bg-red-100 text-red-800'
                          : ''
                  }
                >
                  {result.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">{scenario.description}</p>
              <p className="text-xs text-muted-foreground mb-2">
                Project name: <strong>{scenario.projectName}</strong>
              </p>

              {result.error && <p className="text-xs text-red-600 mt-1">Error: {result.error}</p>}

              {result.validation && (
                <ScrollArea className="max-h-48 mt-2">
                  <div className="space-y-1">
                    {result.validation.errors.map((e, ei) => (
                      <p key={`e-${ei}`} className="text-xs text-red-600">
                        Error: {e}
                      </p>
                    ))}
                    {result.validation.warnings.map((w, wi) => (
                      <p key={`w-${wi}`} className="text-xs text-amber-600">
                        Warning: {w}
                      </p>
                    ))}
                    {result.validation.pass && result.validation.warnings.length === 0 && (
                      <p className="text-xs text-green-600 font-medium">
                        All validation checks passed.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
