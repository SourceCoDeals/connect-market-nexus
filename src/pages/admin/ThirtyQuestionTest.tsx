/**
 * 30-Question QA Test Runner
 *
 * Sends 30 pre-built questions to the AI Command Center one-by-one,
 * compares actual responses to predicted behavior, and shows summary stats.
 */

import { useState, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { THIRTY_Q_SUITE, type ThirtyQQuestion } from './chatbot-test-runner/thirtyQuestionSuite';
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

        setResults((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: hasError ? 'fail' : hasResponse ? 'pass' : 'fail',
            actualResponse: res.text || res.error || '(empty)',
            routeCategory: res.routeInfo?.category || 'unknown',
            tools: res.toolCalls.map((t) => t.name),
            durationMs,
            error: res.error || undefined,
          };
          return next;
        });
      } catch (err) {
        if (controller.signal.aborted) break;
        const durationMs = Math.round(performance.now() - start);
        setResults((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: 'error',
            actualResponse: '',
            durationMs,
            error: err instanceof Error ? err.message : String(err),
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
  }, []);

  // ---------- Stats ----------

  const completed = results.filter((r) => ['pass', 'fail', 'error'].includes(r.status));
  const passed = results.filter((r) => r.status === 'pass');
  const failed = results.filter((r) => r.status === 'fail' || r.status === 'error');
  const avgTime =
    completed.length > 0
      ? Math.round(completed.reduce((s, r) => s + r.durationMs, 0) / completed.length)
      : 0;
  const successRate = completed.length > 0 ? Math.round((passed.length / completed.length) * 100) : 0;
  const progress = Math.round((completed.length / THIRTY_Q_SUITE.length) * 100);

  // ---------- Export ----------

  const handleExport = useCallback(() => {
    const rows = results.map((r) => ({
      id: r.question.id,
      category: r.question.category,
      question: r.question.question,
      expected: r.question.expectedBehavior,
      status: r.status,
      route_category: r.routeCategory,
      tools_used: r.tools.join(', '),
      duration_ms: r.durationMs,
      actual_response: r.actualResponse.substring(0, 500),
      error: r.error || '',
    }));
    exportToCSV(rows, `30q-test-${new Date().toISOString().slice(0, 10)}`);
  }, [results]);

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{completed.length}/{THIRTY_Q_SUITE.length}</div>
            <p className="text-xs text-muted-foreground">Questions Completed</p>
            <Progress value={progress} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{successRate}%</div>
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-xs text-muted-foreground mt-1">{passed.length} pass / {failed.length} fail</p>
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
                    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 flex-1">
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
  const { question: q, status, actualResponse, routeCategory, tools, durationMs, error } = result;

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
            <Badge variant="outline" className="text-xs">{q.category}</Badge>
            {status !== 'pending' && status !== 'running' && (
              <>
                <Badge variant="secondary" className="text-xs">Route: {routeCategory}</Badge>
                <span className="text-xs text-muted-foreground">{durationMs.toLocaleString()}ms</span>
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
                      <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
