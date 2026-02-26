/**
 * 30-Question QA Test Page
 *
 * Sends 30 diverse questions to the AI Command Center and displays:
 *  - Predicted response & rating (from code analysis)
 *  - Actual response, route, tools, duration
 *  - Side-by-side comparison
 *
 * Uses the existing sendAIQuery() infrastructure from chatbotInfraTests.
 */

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  RotateCcw,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  Download,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sendAIQuery } from './chatbot-test-runner/chatbotInfraTests';
import {
  type QAQuestion,
  type QAResult,
  THIRTY_Q_STORAGE_KEY,
  getThirtyQuestions,
} from './chatbot-test-runner/thirtyQuestionSuite';

// ── Helpers ──

function loadStoredResults(): Map<number, QAResult> {
  try {
    const stored = localStorage.getItem(THIRTY_Q_STORAGE_KEY);
    if (stored) {
      const arr: QAResult[] = JSON.parse(stored);
      return new Map(arr.map((r) => [r.id, r]));
    }
  } catch {
    /* ignore */
  }
  return new Map();
}

function saveResults(results: Map<number, QAResult>) {
  try {
    localStorage.setItem(THIRTY_Q_STORAGE_KEY, JSON.stringify([...results.values()]));
  } catch {
    /* ignore */
  }
}

function ratingColor(rating: number): string {
  if (rating >= 8) return 'text-green-600 dark:text-green-400';
  if (rating >= 6) return 'text-yellow-600 dark:text-yellow-400';
  if (rating >= 4) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function ratingBg(rating: number): string {
  if (rating >= 8) return 'bg-green-100 dark:bg-green-950';
  if (rating >= 6) return 'bg-yellow-100 dark:bg-yellow-950';
  if (rating >= 4) return 'bg-orange-100 dark:bg-orange-950';
  return 'bg-red-100 dark:bg-red-950';
}

const categoryColors: Record<string, string> = {
  'Pipeline Analytics': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  'Deal Status': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  'Buyer Search': 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  Contacts: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
  'Contact Enrichment': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  'Platform Guide': 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  'Meeting Intel': 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  Outreach: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  'Follow-Up': 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  'Daily Briefing': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Engagement: 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300',
  'Content Creation': 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  'Market Analysis': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  'Calling List': 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  'Lead Intel': 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300',
  Action: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  'Edge Case': 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300',
};

export default function ThirtyQuestionTest() {
  const questions = getThirtyQuestions();
  const [results, setResults] = useState<Map<number, QAResult>>(loadStoredResults);
  const [running, setRunning] = useState(false);
  const [currentQ, setCurrentQ] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const completedCount = [...results.values()].filter(
    (r) => r.status === 'done' || r.status === 'error',
  ).length;
  const progress = (completedCount / questions.length) * 100;

  const runSingleQuestion = useCallback(
    async (q: QAQuestion, signal: AbortSignal): Promise<QAResult> => {
      const start = Date.now();
      try {
        const res = await sendAIQuery(q.question, 60000, signal);
        return {
          id: q.id,
          status: res.error ? 'error' : 'done',
          actualResponse: res.text || '',
          actualRoute: res.routeInfo?.category || 'unknown',
          actualTools: res.toolCalls.map((t) => t.name),
          durationMs: Date.now() - start,
          actualRating: null,
          bypassed: res.routeInfo?.bypassed,
          confidence: res.routeInfo?.confidence,
          error: res.error || undefined,
        };
      } catch (err) {
        return {
          id: q.id,
          status: 'error',
          actualResponse: '',
          actualRoute: 'error',
          actualTools: [],
          durationMs: Date.now() - start,
          actualRating: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    [],
  );

  const runAllQuestions = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);

    const newResults = new Map(results);

    for (const q of questions) {
      if (controller.signal.aborted) break;

      // Skip already completed
      if (newResults.get(q.id)?.status === 'done') continue;

      setCurrentQ(q.id);
      newResults.set(q.id, {
        id: q.id,
        status: 'running',
        actualResponse: '',
        actualRoute: '',
        actualTools: [],
        durationMs: 0,
        actualRating: null,
      });
      setResults(new Map(newResults));

      const result = await runSingleQuestion(q, controller.signal);
      newResults.set(q.id, result);
      setResults(new Map(newResults));
      saveResults(newResults);

      // Small delay between questions to avoid rate limiting
      if (!controller.signal.aborted) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    setCurrentQ(null);
    setRunning(false);
    abortRef.current = null;
    toast.success(
      `Completed ${[...newResults.values()].filter((r) => r.status === 'done').length}/30 questions`,
    );
  }, [questions, results, runSingleQuestion]);

  const runSingle = useCallback(
    async (q: QAQuestion) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      setCurrentQ(q.id);

      const newResults = new Map(results);
      newResults.set(q.id, {
        id: q.id,
        status: 'running',
        actualResponse: '',
        actualRoute: '',
        actualTools: [],
        durationMs: 0,
        actualRating: null,
      });
      setResults(new Map(newResults));

      const result = await runSingleQuestion(q, controller.signal);
      newResults.set(q.id, result);
      setResults(new Map(newResults));
      saveResults(newResults);

      setCurrentQ(null);
      setRunning(false);
      abortRef.current = null;

      // Auto-expand the row
      setExpandedRows((prev) => new Set([...prev, q.id]));
    },
    [results, runSingleQuestion],
  );

  const stopTests = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setCurrentQ(null);
  }, []);

  const resetAll = useCallback(() => {
    setResults(new Map());
    setExpandedRows(new Set());
    localStorage.removeItem(THIRTY_Q_STORAGE_KEY);
    toast.info('All results cleared');
  }, []);

  const exportCSV = useCallback(() => {
    const headers = [
      '#',
      'Category',
      'Question',
      'Expected Route',
      'Expected Tools',
      'Predicted Rating',
      'Predicted Response',
      'Actual Route',
      'Actual Tools',
      'Actual Response (first 500 chars)',
      'Duration (ms)',
      'Status',
    ];

    const rows = questions.map((q) => {
      const r = results.get(q.id);
      return [
        q.id,
        q.category,
        `"${q.question.replace(/"/g, '""')}"`,
        q.expectedRoute,
        q.expectedTools.join('; '),
        q.predictedRating,
        `"${q.predictedResponse.replace(/"/g, '""')}"`,
        r?.actualRoute || '',
        (r?.actualTools || []).join('; '),
        `"${(r?.actualResponse || '').substring(0, 500).replace(/"/g, '""')}"`,
        r?.durationMs || '',
        r?.status || 'pending',
      ];
    });

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-30q-test-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }, [questions, results]);

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    },
    [],
  );

  // ── Summary stats ──
  const doneResults = [...results.values()].filter((r) => r.status === 'done');
  const errorResults = [...results.values()].filter((r) => r.status === 'error');
  const avgDuration =
    doneResults.length > 0
      ? Math.round(doneResults.reduce((sum, r) => sum + r.durationMs, 0) / doneResults.length)
      : 0;

  // Route match check
  const routeMatches = doneResults.filter((r) => {
    const q = questions.find((qq) => qq.id === r.id);
    return q && r.actualRoute === q.expectedRoute;
  }).length;

  // Bypass rate — how many queries were handled by bypass rules (no LLM classification)
  const bypassCount = doneResults.filter((r) => r.bypassed).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">30-Question AI Chatbot QA</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sends 30 questions across all categories. Compares predicted vs actual responses.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!running ? (
              <Button onClick={runAllQuestions} className="gap-2">
                <Play className="h-4 w-4" />
                Run All ({30 - completedCount} remaining)
              </Button>
            ) : (
              <Button onClick={stopTests} variant="destructive" className="gap-2">
                <SkipForward className="h-4 w-4" />
                Stop
              </Button>
            )}
            <Button onClick={exportCSV} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={resetAll} variant="ghost" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              {completedCount}/30 complete
              {running && currentQ ? ` — Running Q${currentQ}...` : ''}
            </span>
            <span className="text-muted-foreground">
              {doneResults.length} passed, {errorResults.length} errors
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Summary cards */}
        {doneResults.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Avg Response Time</div>
              <div className="text-2xl font-bold">{(avgDuration / 1000).toFixed(1)}s</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Route Accuracy</div>
              <div className="text-2xl font-bold">
                {doneResults.length > 0
                  ? Math.round((routeMatches / doneResults.length) * 100)
                  : 0}
                %
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Success Rate</div>
              <div className="text-2xl font-bold">
                {completedCount > 0
                  ? Math.round((doneResults.length / completedCount) * 100)
                  : 0}
                %
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Bypass Rate</div>
              <div className="text-2xl font-bold">
                {doneResults.length > 0
                  ? Math.round((bypassCount / doneResults.length) * 100)
                  : 0}
                %
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {bypassCount}/{doneResults.length} bypassed LLM
              </div>
            </div>
          </div>
        )}

        {/* Questions table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b">
                <tr>
                  <th className="px-3 py-3 text-left font-medium w-8">#</th>
                  <th className="px-3 py-3 text-left font-medium w-32">Category</th>
                  <th className="px-3 py-3 text-left font-medium">Question</th>
                  <th className="px-3 py-3 text-center font-medium w-20">Predicted</th>
                  <th className="px-3 py-3 text-center font-medium w-24">Route</th>
                  <th className="px-3 py-3 text-center font-medium w-20">Duration</th>
                  <th className="px-3 py-3 text-center font-medium w-20">Status</th>
                  <th className="px-3 py-3 text-center font-medium w-16">Run</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {questions.map((q) => {
                  const r = results.get(q.id);
                  const isExpanded = expandedRows.has(q.id);
                  const routeMatch = r?.status === 'done' && r.actualRoute === q.expectedRoute;

                  return (
                    <>
                      <tr
                        key={q.id}
                        className={cn(
                          'hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors',
                          currentQ === q.id && 'bg-blue-50 dark:bg-blue-950',
                        )}
                        onClick={() => toggleRow(q.id)}
                      >
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            {q.id}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant="secondary"
                            className={cn('text-xs', categoryColors[q.category])}
                          >
                            {q.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 max-w-md">
                          <span className="line-clamp-1">{q.question}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={cn(
                              'inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm',
                              ratingBg(q.predictedRating),
                              ratingColor(q.predictedRating),
                            )}
                          >
                            {q.predictedRating}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r?.status === 'done' ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs',
                                routeMatch
                                  ? 'border-green-500 text-green-700 dark:text-green-400'
                                  : 'border-red-500 text-red-700 dark:text-red-400',
                              )}
                            >
                              {r.actualRoute}
                            </Badge>
                          ) : r?.status === 'running' ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-blue-500" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-muted-foreground">
                          {r?.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r?.status === 'done' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : r?.status === 'error' ? (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          ) : r?.status === 'running' ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-blue-500" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            disabled={running}
                            onClick={(e) => {
                              e.stopPropagation();
                              runSingle(q);
                            }}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${q.id}-detail`} className="bg-gray-50/50 dark:bg-gray-900/50">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Predicted */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  Predicted
                                  <span
                                    className={cn(
                                      'text-xs px-2 py-0.5 rounded-full',
                                      ratingBg(q.predictedRating),
                                      ratingColor(q.predictedRating),
                                    )}
                                  >
                                    {q.predictedRating}/10
                                  </span>
                                </h4>
                                <div className="text-xs space-y-1">
                                  <div>
                                    <span className="font-medium">Expected Route:</span>{' '}
                                    {q.expectedRoute}
                                  </div>
                                  <div>
                                    <span className="font-medium">Expected Tools:</span>{' '}
                                    {q.expectedTools.join(', ') || 'none'}
                                  </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 border rounded p-3 text-xs whitespace-pre-wrap">
                                  {q.predictedResponse}
                                </div>
                              </div>

                              {/* Actual */}
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  Actual
                                  {r?.status === 'done' && (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs',
                                        r.actualRoute === q.expectedRoute
                                          ? 'border-green-500'
                                          : 'border-red-500',
                                      )}
                                    >
                                      {r.actualRoute}
                                    </Badge>
                                  )}
                                  {r?.durationMs && (
                                    <span className="text-xs text-muted-foreground">
                                      {(r.durationMs / 1000).toFixed(1)}s
                                    </span>
                                  )}
                                </h4>
                                {r?.status === 'done' || r?.status === 'error' ? (
                                  <>
                                    <div className="text-xs space-y-1">
                                      <div>
                                        <span className="font-medium">Route:</span>{' '}
                                        {r.actualRoute}
                                        {r.actualRoute === q.expectedRoute
                                          ? ' ✓'
                                          : ` (expected: ${q.expectedRoute})`}
                                        {r.bypassed != null && (
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              'ml-2 text-[10px] px-1.5 py-0',
                                              r.bypassed
                                                ? 'border-green-500 text-green-700 dark:text-green-400'
                                                : 'border-yellow-500 text-yellow-700 dark:text-yellow-400',
                                            )}
                                          >
                                            {r.bypassed ? 'bypass' : 'LLM'}
                                          </Badge>
                                        )}
                                        {r.confidence != null && (
                                          <span className="ml-1 text-muted-foreground">
                                            ({(r.confidence * 100).toFixed(0)}%)
                                          </span>
                                        )}
                                      </div>
                                      <div>
                                        <span className="font-medium">Tools:</span>{' '}
                                        {r.actualTools.join(', ') || 'none'}
                                      </div>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 border rounded p-3 text-xs whitespace-pre-wrap max-h-64 overflow-y-auto relative group">
                                      {r.error ? (
                                        <span className="text-red-600">{r.error}</span>
                                      ) : (
                                        r.actualResponse || '(empty response)'
                                      )}
                                      <button
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() =>
                                          copyToClipboard(r.error || r.actualResponse || '')
                                        }
                                      >
                                        <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                      </button>
                                    </div>
                                  </>
                                ) : r?.status === 'running' ? (
                                  <div className="flex items-center gap-2 text-sm text-blue-600">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Running...
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground italic">
                                    Not yet run. Click the play button or "Run All" to test.
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
