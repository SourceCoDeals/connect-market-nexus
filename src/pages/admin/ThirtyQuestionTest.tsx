/**
 * 35-Question QA Test Runner
 *
 * Sends 35 pre-built questions to the AI Command Center one-by-one,
 * compares actual responses to predicted behavior, and shows summary stats
 * including route accuracy tracking and per-question quality scoring.
 *
 * Q1-30: Core coverage across all categories
 * Q31-35: LinkedIn profile identification & contact enrichment
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  Square,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RotateCcw,
  Target,
  Award,
} from 'lucide-react';
import {
  THIRTY_Q_SUITE,
  scoreThirtyQResponse,
  PE_GRADE_LABELS,
  type ThirtyQQuestion,
  type ThirtyQScore,
  type ThirtyQCheckResult,
} from './chatbot-test-runner/thirtyQuestionSuite';
import { sendAIQuery } from './chatbot-test-runner/chatbotInfraTests';
import { exportToCSV } from '@/lib/exportUtils';

// ---------- Types ----------

type RunStatus = 'idle' | 'running' | 'done' | 'cancelled';

interface QuestionResult {
  question: ThirtyQQuestion;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'error';
  actualResponse: string;
  routeCategory: string;
  tools: string[];
  durationMs: number;
  error?: string;
  score?: ThirtyQScore;
}

const THIRTY_Q_STORAGE_KEY = 'sourceco-30q-test-results';

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  B: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  C: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  D: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  F: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

function scoreColor(total: number): string {
  if (total >= 90) return 'text-green-600';
  if (total >= 75) return 'text-blue-600';
  if (total >= 60) return 'text-yellow-600';
  if (total >= 40) return 'text-orange-600';
  return 'text-red-600';
}

// ---------- Component ----------

export default function ThirtyQuestionTest() {
  const [results, setResults] = useState<QuestionResult[]>(() =>
    THIRTY_Q_SUITE.map((q) => ({
      question: q,
      status: 'pending',
      actualResponse: '',
      routeCategory: '',
      tools: [],
      durationMs: 0,
    })),
  );
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const abortRef = useRef<AbortController | null>(null);

  // Persist results to localStorage once when a run finishes so Export All can pick them up
  const prevRunStatus = useRef<RunStatus>('idle');
  useEffect(() => {
    const wasRunning = prevRunStatus.current === 'running';
    prevRunStatus.current = runStatus;
    if (wasRunning && (runStatus === 'done' || runStatus === 'cancelled')) {
      try {
        localStorage.setItem(THIRTY_Q_STORAGE_KEY, JSON.stringify(results));
        localStorage.setItem(THIRTY_Q_STORAGE_KEY + '-ts', new Date().toISOString());
      } catch {
        /* ignore storage errors */
      }
    }
  }, [runStatus, results]);

  // ---------- Run all ----------

  const runAll = useCallback(async () => {
    setRunStatus('running');
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset results
    setResults(
      THIRTY_Q_SUITE.map((q) => ({
        question: q,
        status: 'pending',
        actualResponse: '',
        routeCategory: '',
        tools: [],
        durationMs: 0,
      })),
    );

    for (let i = 0; i < THIRTY_Q_SUITE.length; i++) {
      if (controller.signal.aborted) break;

      const q = THIRTY_Q_SUITE[i];

      // Mark running
      setResults((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'running' };
        return next;
      });

      const start = performance.now();
      try {
        const res = await sendAIQuery(q.question, 60000, controller.signal);
        const durationMs = Math.round(performance.now() - start);

        const hasError = !!res.error;
        const hasResponse = !!res.text?.trim();

        const routeCategory = res.routeInfo?.category || 'unknown';
        const toolNames = res.toolCalls.map((t) => t.name);

        // Score the response from a PE partner's perspective
        const score = scoreThirtyQResponse(q, {
          text: res.text || '',
          tools: toolNames,
          routeCategory,
          error: res.error || undefined,
          durationMs,
        });

        setResults((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: hasError ? 'fail' : hasResponse ? 'pass' : 'fail',
            actualResponse: res.text || res.error || '(empty)',
            routeCategory,
            tools: toolNames,
            durationMs,
            error: res.error || undefined,
            score,
          };
          return next;
        });
      } catch (err) {
        if (controller.signal.aborted) break;
        const durationMs = Math.round(performance.now() - start);

        const score = scoreThirtyQResponse(q, {
          text: '',
          tools: [],
          routeCategory: 'unknown',
          error: err instanceof Error ? err.message : String(err),
          durationMs,
        });

        setResults((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: 'error',
            actualResponse: '',
            durationMs,
            error: err instanceof Error ? err.message : String(err),
            score,
          };
          return next;
        });
      }
    }

    setRunStatus(controller.signal.aborted ? 'cancelled' : 'done');
    abortRef.current = null;
  }, []);

  const stopRun = useCallback(() => {
    abortRef.current?.abort();
    setRunStatus('cancelled');
  }, []);

  const resetAll = useCallback(() => {
    setRunStatus('idle');
    setResults(
      THIRTY_Q_SUITE.map((q) => ({
        question: q,
        status: 'pending',
        actualResponse: '',
        routeCategory: '',
        tools: [],
        durationMs: 0,
      })),
    );
    try {
      localStorage.removeItem(THIRTY_Q_STORAGE_KEY);
      localStorage.removeItem(THIRTY_Q_STORAGE_KEY + '-ts');
    } catch {
      /* ignore */
    }
  }, []);

  // ---------- Stats ----------

  const completed = results.filter((r) => ['pass', 'fail', 'error'].includes(r.status));
  const passed = results.filter((r) => r.status === 'pass');
  const failed = results.filter((r) => r.status === 'fail' || r.status === 'error');
  const avgTime =
    completed.length > 0
      ? Math.round(completed.reduce((s, r) => s + r.durationMs, 0) / completed.length)
      : 0;
  const successRate =
    completed.length > 0 ? Math.round((passed.length / completed.length) * 100) : 0;
  const progress = Math.round((completed.length / THIRTY_Q_SUITE.length) * 100);

  // Route accuracy
  const routeMatches = completed.filter(
    (r) =>
      r.routeCategory && r.question.expectedRoute && r.routeCategory === r.question.expectedRoute,
  );
  const routeAccuracy =
    completed.length > 0 ? Math.round((routeMatches.length / completed.length) * 100) : 0;

  // Quality score (average of all scored results)
  const scoredResults = completed.filter((r) => r.score);
  const avgScore = useMemo(() => {
    if (scoredResults.length === 0) return 0;
    return Math.round(
      scoredResults.reduce((s, r) => s + (r.score?.total ?? 0), 0) / scoredResults.length,
    );
  }, [scoredResults]);

  const overallGrade =
    avgScore >= 90 ? 'A' : avgScore >= 75 ? 'B' : avgScore >= 60 ? 'C' : avgScore >= 40 ? 'D' : 'F';
  const overallLabel = PE_GRADE_LABELS[overallGrade];

  // Per-category scores
  const categoryScores = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const r of scoredResults) {
      const cat = r.question.category;
      const entry = map.get(cat) || { total: 0, count: 0 };
      entry.total += r.score?.total ?? 0;
      entry.count += 1;
      map.set(cat, entry);
    }
    return Array.from(map.entries())
      .map(([cat, { total, count }]) => ({ category: cat, avg: Math.round(total / count), count }))
      .sort((a, b) => a.avg - b.avg);
  }, [scoredResults]);

  // ---------- Export ----------

  const handleExport = useCallback(() => {
    const rows = results.map((r) => ({
      id: r.question.id,
      category: r.question.category,
      question: r.question.question,
      expected_route: r.question.expectedRoute,
      actual_route: r.routeCategory,
      route_match: r.routeCategory === r.question.expectedRoute ? 'YES' : 'NO',
      expected: r.question.expectedBehavior,
      status: r.status,
      partner_score: r.score?.total ?? '',
      grade: r.score?.grade ?? '',
      grade_label: r.score?.gradeLabel ?? '',
      checks_passed: r.score ? r.score.checks.filter((c) => c.passed).length : '',
      checks_total: r.score ? r.score.checks.length : '',
      check_details: r.score
        ? r.score.checks
            .map((c) => `${c.passed ? 'PASS' : 'FAIL'}: ${c.name} — ${c.detail || ''}`)
            .join(' | ')
        : '',
      tools_used: r.tools.join(', '),
      duration_ms: r.durationMs,
      actual_response: r.actualResponse.substring(0, 500),
      error: r.error || '',
    }));
    exportToCSV(rows, `30q-scored-${new Date().toISOString().slice(0, 10)}`);
  }, [results]);

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {completed.length}/{THIRTY_Q_SUITE.length}
            </div>
            <p className="text-xs text-muted-foreground">Questions Completed</p>
            <Progress value={progress} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{successRate}%</div>
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-xs text-muted-foreground mt-1">
              {passed.length} pass / {failed.length} fail
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div
              className={`text-2xl font-bold ${routeAccuracy >= 80 ? 'text-green-600' : routeAccuracy >= 50 ? 'text-yellow-600' : 'text-red-600'}`}
            >
              {routeAccuracy}%
            </div>
            <p className="text-xs text-muted-foreground">Route Accuracy</p>
            <p className="text-xs text-muted-foreground mt-1">
              {routeMatches.length}/{completed.length} correct
            </p>
          </CardContent>
        </Card>
        {/* PE Partner Score card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore}</span>
              <Badge className={`text-xs ${GRADE_COLORS[overallGrade] || ''}`}>
                {overallGrade}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Partner Score</p>
            <p className="text-xs text-muted-foreground mt-1">
              {overallLabel} — {scoredResults.length} scored
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{avgTime.toLocaleString()}ms</div>
            <p className="text-xs text-muted-foreground">Avg Response Time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex flex-col gap-2">
            {runStatus === 'idle' || runStatus === 'done' || runStatus === 'cancelled' ? (
              <>
                <Button onClick={runAll} className="gap-2">
                  <Play className="h-4 w-4" /> Run All
                </Button>
                {runStatus !== 'idle' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetAll} className="gap-1 flex-1">
                      <RotateCcw className="h-3 w-3" /> Reset
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      className="gap-1 flex-1"
                    >
                      <Download className="h-3 w-3" /> CSV
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Button variant="destructive" onClick={stopRun} className="gap-2">
                <Square className="h-4 w-4" /> Stop
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown (shown after scoring) */}
      {categoryScores.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Partner Score by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categoryScores.map(({ category, avg, count }) => {
                const g =
                  avg >= 90 ? 'A' : avg >= 75 ? 'B' : avg >= 60 ? 'C' : avg >= 40 ? 'D' : 'F';
                return (
                  <Badge
                    key={category}
                    variant="secondary"
                    className={`text-xs gap-1 ${GRADE_COLORS[g]}`}
                  >
                    {category}: {avg}
                    <span className="opacity-60">({count}q)</span>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Results</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="divide-y">
              {results.map((r) => (
                <ResultRow key={r.question.id} result={r} />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Result row ----------

function ResultRow({ result }: { result: QuestionResult }) {
  const {
    question: q,
    status,
    actualResponse,
    routeCategory,
    tools,
    durationMs,
    error,
    score,
  } = result;
  const routeMatch = routeCategory && q.expectedRoute && routeCategory === q.expectedRoute;

  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    pass: <CheckCircle2 className="h-4 w-4 text-primary" />,
    fail: <XCircle className="h-4 w-4 text-destructive" />,
    error: <XCircle className="h-4 w-4 text-destructive" />,
  }[status];

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">Q{q.id}.</span>
            <Badge variant="outline" className="text-xs">
              {q.category}
            </Badge>
            {status !== 'pending' && status !== 'running' && (
              <>
                <Badge
                  variant="secondary"
                  className={`text-xs ${routeMatch ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}`}
                >
                  <Target className="h-3 w-3 mr-1" />
                  {routeCategory}
                  {!routeMatch && routeCategory && (
                    <span className="ml-1 opacity-60">(exp: {q.expectedRoute})</span>
                  )}
                </Badge>
                {score && (
                  <Badge
                    variant="secondary"
                    className={`text-xs gap-1 ${GRADE_COLORS[score.grade]}`}
                  >
                    <Award className="h-3 w-3" />
                    {score.total}/100 {score.grade} — {score.gradeLabel}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {durationMs.toLocaleString()}ms
                </span>
              </>
            )}
          </div>
          <p className="text-sm mt-1">{q.question}</p>

          {/* Expected vs Actual */}
          {(status === 'pass' || status === 'fail' || status === 'error') && (
            <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Expected</p>
                <p className="text-xs">{q.expectedBehavior}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Actual</p>
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : (
                  <p className="text-xs line-clamp-4">{actualResponse}</p>
                )}
                {tools.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {tools.map((t, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auto-Check Scoring Details */}
          {score && score.checks.length > 0 && (
            <div className="mt-2 rounded-md border bg-muted/20 p-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Scoring Checks ({score.checks.filter((c) => c.passed).length}/{score.checks.length}{' '}
                passed):
              </p>
              <div className="space-y-0.5">
                {score.checks.map((check, i) => (
                  <CheckRow key={i} check={check} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Check row ----------

function CheckRow({ check }: { check: ThirtyQCheckResult }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {check.passed ? (
        <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-3 w-3 text-destructive flex-shrink-0 mt-0.5" />
      )}
      <span className={check.passed ? '' : 'text-destructive'}>
        {check.name}
        <span className="text-muted-foreground ml-1">({check.weight}pts)</span>
      </span>
      {check.detail && <span className="text-muted-foreground truncate">— {check.detail}</span>}
    </div>
  );
}
