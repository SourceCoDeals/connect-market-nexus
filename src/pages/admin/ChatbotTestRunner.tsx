/**
 * ChatbotTestRunner: Comprehensive in-app test runner for AI Chatbot QA.
 * Two sections:
 *  1. Infrastructure Tests — automated pass/fail checks for chat tables, persistence, analytics, edge functions
 *  2. QA Scenarios — automated + manual test scenarios with inline AI response display
 */

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Copy,
  ChevronDown,
  ChevronRight,
  Loader2,
  Cpu,
  ClipboardList,
  SkipForward,
  RotateCw,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  type ChatbotTestStatus,
  type ChatbotTestResult,
  type ChatbotTestContext,
  CHATBOT_INFRA_STORAGE_KEY,
  buildChatbotTests,
  sendAIQuery,
} from './chatbot-test-runner/chatbotInfraTests';
import {
  type ScenarioResult,
  type ScenarioStatus,
  SCENARIO_STORAGE_KEY,
  getChatbotTestScenarios,
  runAutoChecks,
} from './chatbot-test-runner/chatbotTestScenarios';

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function loadStoredResults<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore parse errors */
  }
  return fallback;
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage errors */
  }
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
};

const statusIcon = (status: ChatbotTestStatus | ScenarioStatus) => {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'fail':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'warn':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'skip':
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    default:
      return <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />;
  }
};

// ═══════════════════════════════════════════
// Infrastructure Tests Section
// ═══════════════════════════════════════════

function InfraTestsTab() {
  const [results, setResults] = useState<ChatbotTestResult[]>(() =>
    loadStoredResults(CHATBOT_INFRA_STORAGE_KEY, []),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [lastRunAt, setLastRunAt] = useState<string | null>(() =>
    loadStoredResults(CHATBOT_INFRA_STORAGE_KEY + '-ts', null),
  );
  const abortRef = useRef(false);

  const runTests = useCallback(
    async (onlyFailed = false) => {
      setIsRunning(true);
      abortRef.current = false;

      const allTests = buildChatbotTests();
      const testsToRun = onlyFailed
        ? allTests.filter((t) => results.find((r) => r.id === t.id && r.status === 'fail'))
        : allTests;

      const initialResults: ChatbotTestResult[] = allTests.map((t) => {
        const existing = results.find((r) => r.id === t.id);
        const shouldRun = testsToRun.some((tr) => tr.id === t.id);
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          status: shouldRun ? 'pending' : existing?.status || 'pending',
          error: shouldRun ? undefined : existing?.error,
          durationMs: shouldRun ? undefined : existing?.durationMs,
        };
      });
      setResults(initialResults);

      const ctx: ChatbotTestContext = {
        createdConversationIds: [],
        createdAnalyticsIds: [],
        createdFeedbackIds: [],
      };

      const updated = [...initialResults];

      for (const test of testsToRun) {
        if (abortRef.current) break;
        const idx = updated.findIndex((r) => r.id === test.id);
        updated[idx] = { ...updated[idx], status: 'running' };
        setResults([...updated]);

        const start = performance.now();
        try {
          await test.fn(ctx);
          updated[idx] = {
            ...updated[idx],
            status: 'pass',
            durationMs: Math.round(performance.now() - start),
            error: undefined,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          const isWarning =
            (msg.includes('does not exist') && !msg.includes('table')) ||
            msg.includes('empty') ||
            msg.includes('Expected multiple');
          updated[idx] = {
            ...updated[idx],
            status: isWarning ? 'warn' : 'fail',
            error: msg,
            durationMs: Math.round(performance.now() - start),
          };
        }
        setResults([...updated]);
      }

      const ts = new Date().toISOString();
      setLastRunAt(ts);
      saveToStorage(CHATBOT_INFRA_STORAGE_KEY, updated);
      saveToStorage(CHATBOT_INFRA_STORAGE_KEY + '-ts', ts);
      setIsRunning(false);
    },
    [results],
  );

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const copyFailed = () => {
    const failed = results.filter((r) => r.status === 'fail');
    const text = failed.map((r) => `[${r.category}] ${r.name}\n   ${r.error}`).join('\n\n');
    navigator.clipboard.writeText(text || 'No failures!');
  };

  const categories = Array.from(new Set(results.map((r) => r.category)));
  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;
  const totalCount = results.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {totalCount} infrastructure tests
            {lastRunAt && ` · Last run: ${new Date(lastRunAt).toLocaleString()}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => runTests(false)} disabled={isRunning} size="sm">
            {isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run All
          </Button>
          {failCount > 0 && (
            <Button variant="outline" onClick={() => runTests(true)} disabled={isRunning} size="sm">
              <RotateCcw className="mr-2 h-4 w-4" />
              Re-run Failed
            </Button>
          )}
          <Button variant="outline" onClick={copyFailed} size="sm">
            <Copy className="mr-2 h-4 w-4" />
            Copy Failed
          </Button>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="flex gap-4 p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="font-medium">{passCount} passed</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="font-medium">{failCount} failed</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span className="font-medium">{warnCount} warnings</span>
          </div>
          <div className="text-muted-foreground">of {totalCount} tests</div>
        </div>
      )}

      <div className="space-y-2">
        {categories.map((cat) => {
          const catResults = results.filter((r) => r.category === cat);
          const catPassed = catResults.filter((r) => r.status === 'pass').length;
          const catFailed = catResults.filter((r) => r.status === 'fail').length;
          const isCollapsed = collapsedCategories.has(cat);

          return (
            <div key={cat} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="font-semibold text-sm">{cat}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="text-green-600">{catPassed}✓</span>
                  {catFailed > 0 && <span className="text-destructive">{catFailed}✗</span>}
                  <span>{catResults.length} total</span>
                </div>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-border/50">
                  {catResults.map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-2 text-sm',
                        r.status === 'fail' && 'bg-destructive/5',
                      )}
                    >
                      <div className="mt-0.5">{statusIcon(r.status)}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{r.name}</span>
                        {r.durationMs !== undefined && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {r.durationMs}ms
                          </span>
                        )}
                        {r.error && (
                          <p className="text-xs text-destructive mt-1 break-all font-mono">
                            {r.error}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// QA Scenarios Section
// ═══════════════════════════════════════════

function ScenariosTab() {
  const scenarios = getChatbotTestScenarios();
  const [scenarioResults, setScenarioResults] = useState<Record<string, ScenarioResult>>(() =>
    loadStoredResults(SCENARIO_STORAGE_KEY, {}),
  );
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);

  const updateResult = useCallback((id: string, status: ScenarioStatus, notes?: string) => {
    setScenarioResults((prev) => {
      const updated = {
        ...prev,
        [id]: {
          ...prev[id],
          id,
          status,
          notes: notes ?? prev[id]?.notes ?? '',
          testedAt: status !== 'pending' ? new Date().toISOString() : null,
        },
      };
      saveToStorage(SCENARIO_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  // ── Auto-run scenarios ──
  const runScenarios = useCallback(
    async (onlyFailed = false) => {
      setIsRunning(true);
      abortRef.current = false;

      const runnable = scenarios.filter((s) => !s.skipAutoRun);
      const toRun = onlyFailed
        ? runnable.filter((s) => scenarioResults[s.id]?.status === 'fail')
        : runnable;

      for (const scenario of toRun) {
        if (abortRef.current) break;

        // Mark running
        setScenarioResults((prev) => {
          const updated = {
            ...prev,
            [scenario.id]: {
              ...prev[scenario.id],
              id: scenario.id,
              status: 'running' as ScenarioStatus,
              notes: prev[scenario.id]?.notes ?? '',
              testedAt: prev[scenario.id]?.testedAt ?? null,
            },
          };
          saveToStorage(SCENARIO_STORAGE_KEY, updated);
          return updated;
        });

        const start = performance.now();
        try {
          const response = await sendAIQuery(scenario.userMessage, 45000);
          const durationMs = Math.round(performance.now() - start);
          const autoChecks = runAutoChecks(scenario, response);
          const allPassed = autoChecks.length > 0 && autoChecks.every((c) => c.passed);
          const anyFailed = autoChecks.some((c) => !c.passed);

          const status: ScenarioStatus = response.error
            ? 'fail'
            : allPassed
              ? 'pass'
              : anyFailed
                ? 'fail'
                : 'pending';

          setScenarioResults((prev) => {
            const updated = {
              ...prev,
              [scenario.id]: {
                id: scenario.id,
                status,
                notes: prev[scenario.id]?.notes ?? '',
                testedAt: new Date().toISOString(),
                aiResponse: response.text,
                toolsCalled: response.toolCalls.map((t) => t.name),
                routeCategory: response.routeInfo?.category ?? undefined,
                durationMs,
                autoChecks,
                error: response.error ?? undefined,
              },
            };
            saveToStorage(SCENARIO_STORAGE_KEY, updated);
            return updated;
          });
        } catch (err) {
          const durationMs = Math.round(performance.now() - start);
          const errorMsg = err instanceof Error ? err.message : String(err);

          setScenarioResults((prev) => {
            const updated = {
              ...prev,
              [scenario.id]: {
                id: scenario.id,
                status: 'fail' as ScenarioStatus,
                notes: prev[scenario.id]?.notes ?? '',
                testedAt: new Date().toISOString(),
                error: errorMsg,
                durationMs,
                autoChecks: [],
              },
            };
            saveToStorage(SCENARIO_STORAGE_KEY, updated);
            return updated;
          });
        }
      }

      setIsRunning(false);
    },
    [scenarios, scenarioResults],
  );

  const stopRun = useCallback(() => {
    abortRef.current = true;
  }, []);

  const updateNotes = useCallback((id: string, notes: string) => {
    setScenarioResults((prev) => {
      const updated = {
        ...prev,
        [id]: {
          ...prev[id],
          id,
          notes,
          status: prev[id]?.status ?? 'pending',
          testedAt: prev[id]?.testedAt ?? null,
        },
      };
      saveToStorage(SCENARIO_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const toggleScenario = (id: string) => {
    setExpandedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const resetAll = () => {
    setScenarioResults({});
    saveToStorage(SCENARIO_STORAGE_KEY, {});
  };

  const exportResults = () => {
    const lines = scenarios.map((s) => {
      const r = scenarioResults[s.id];
      const status = r?.status ?? 'pending';
      const notes = r?.notes ? ` | Notes: ${r.notes}` : '';
      const tested = r?.testedAt ? ` | Tested: ${new Date(r.testedAt).toLocaleString()}` : '';
      return `[${status.toUpperCase()}] [${s.severity}] ${s.category} > ${s.name}${notes}${tested}`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
  };

  // Stats
  const total = scenarios.length;
  const passCount = scenarios.filter((s) => scenarioResults[s.id]?.status === 'pass').length;
  const failCount = scenarios.filter((s) => scenarioResults[s.id]?.status === 'fail').length;
  const skipCount = scenarios.filter((s) => scenarioResults[s.id]?.status === 'skip').length;
  const pendingCount = total - passCount - failCount - skipCount;

  // Group by category
  const categories = Array.from(new Set(scenarios.map((s) => s.category)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} QA scenarios · {passCount + failCount + skipCount} tested
        </p>
        <div className="flex gap-2">
          {isRunning ? (
            <Button size="sm" variant="destructive" onClick={stopRun}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={() => runScenarios(false)}>
              <Play className="mr-2 h-4 w-4" />
              Run All
            </Button>
          )}
          {failCount > 0 && !isRunning && (
            <Button variant="outline" size="sm" onClick={() => runScenarios(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Re-run Failed
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportResults}>
            <Copy className="mr-2 h-4 w-4" />
            Export Results
          </Button>
          <Button variant="outline" size="sm" onClick={resetAll} disabled={isRunning}>
            <RotateCw className="mr-2 h-4 w-4" />
            Reset All
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4 p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <span className="font-medium">{passCount} passed</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive" />
          <span className="font-medium">{failCount} failed</span>
        </div>
        <div className="flex items-center gap-2">
          <SkipForward className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{skipCount} skipped</span>
        </div>
        <div className="text-muted-foreground">{pendingCount} remaining</div>
        {/* Progress bar */}
        <div className="flex-1 flex items-center">
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{
                width: `${total > 0 ? ((passCount + failCount + skipCount) / total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Scenario groups */}
      <div className="space-y-2">
        {categories.map((cat) => {
          const catScenarios = scenarios.filter((s) => s.category === cat);
          const catPassed = catScenarios.filter(
            (s) => scenarioResults[s.id]?.status === 'pass',
          ).length;
          const catFailed = catScenarios.filter(
            (s) => scenarioResults[s.id]?.status === 'fail',
          ).length;
          const isCollapsed = collapsedCategories.has(cat);

          return (
            <div key={cat} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="font-semibold text-sm">{cat}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="text-green-600">{catPassed}✓</span>
                  {catFailed > 0 && <span className="text-destructive">{catFailed}✗</span>}
                  <span>{catScenarios.length} total</span>
                </div>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-border/50">
                  {catScenarios.map((scenario) => {
                    const result = scenarioResults[scenario.id];
                    const currentStatus = result?.status ?? 'pending';
                    const isExpanded = expandedScenarios.has(scenario.id);

                    return (
                      <div key={scenario.id}>
                        <button
                          onClick={() => toggleScenario(scenario.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-accent/50 transition-colors',
                            currentStatus === 'fail' && 'bg-destructive/5',
                          )}
                        >
                          <div className="mt-0.5">{statusIcon(currentStatus)}</div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{scenario.name}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(scenario.userMessage);
                              toast.success(
                                'Test message copied — paste it into the chatbot widget to run this scenario',
                              );
                            }}
                          >
                            <Play className="mr-1 h-3 w-3" />
                            Launch
                          </Button>
                          {scenario.skipAutoRun && (
                            <Badge variant="outline" className="text-[10px]">
                              Manual
                            </Badge>
                          )}
                          <Badge className={cn('text-[10px]', severityColor[scenario.severity])}>
                            {scenario.severity}
                          </Badge>
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 ml-7 space-y-3 border-t border-border/30">
                            <p className="text-sm text-muted-foreground">{scenario.description}</p>

                            {/* User message */}
                            <div className="rounded-md bg-muted p-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Test Message:
                              </p>
                              <p className="text-sm font-mono">{scenario.userMessage}</p>
                            </div>

                            {/* Expected behavior */}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Expected Behavior:
                              </p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {scenario.expectedBehavior.map((b, i) => (
                                  <li key={i} className="text-sm">
                                    {b}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Edge cases */}
                            {scenario.edgeCases && scenario.edgeCases.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">
                                  Edge Cases to Try:
                                </p>
                                <ul className="list-disc list-inside space-y-0.5">
                                  {scenario.edgeCases.map((e, i) => (
                                    <li key={i} className="text-sm text-muted-foreground">
                                      {e}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* AI Response (auto-run result) */}
                            {result?.aiResponse && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">
                                  AI Response:
                                </p>
                                <div className="rounded-md bg-muted/50 border p-3 max-h-48 overflow-y-auto">
                                  <p className="text-sm whitespace-pre-wrap">{result.aiResponse}</p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {result.durationMs && `${(result.durationMs / 1000).toFixed(1)}s`}
                                  {result.routeCategory && ` · Route: ${result.routeCategory}`}
                                  {result.toolsCalled &&
                                    result.toolsCalled.length > 0 &&
                                    ` · Tools: ${result.toolsCalled.join(', ')}`}
                                </p>
                              </div>
                            )}

                            {/* Error */}
                            {result?.error && (
                              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                                <p className="text-sm text-destructive font-mono">{result.error}</p>
                              </div>
                            )}

                            {/* Auto-Check Results */}
                            {result?.autoChecks && result.autoChecks.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">
                                  Auto-Checks:
                                </p>
                                <div className="space-y-1">
                                  {result.autoChecks.map((check, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm">
                                      {check.passed ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                                      ) : (
                                        <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                                      )}
                                      <span className={check.passed ? '' : 'text-destructive'}>
                                        {check.name}
                                      </span>
                                      {check.detail && (
                                        <span className="text-xs text-muted-foreground truncate">
                                          — {check.detail}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Notes:
                              </p>
                              <Textarea
                                placeholder="Add testing notes, observed behavior, or bug details..."
                                value={result?.notes ?? ''}
                                onChange={(e) => updateNotes(scenario.id, e.target.value)}
                                className="text-sm h-20 resize-none"
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                variant={currentStatus === 'pass' ? 'default' : 'outline'}
                                className={
                                  currentStatus === 'pass' ? 'bg-green-600 hover:bg-green-700' : ''
                                }
                                onClick={() => updateResult(scenario.id, 'pass')}
                              >
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                Pass
                              </Button>
                              <Button
                                size="sm"
                                variant={currentStatus === 'fail' ? 'destructive' : 'outline'}
                                onClick={() => updateResult(scenario.id, 'fail')}
                              >
                                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                Fail
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={currentStatus === 'skip' ? 'bg-muted' : ''}
                                onClick={() => updateResult(scenario.id, 'skip')}
                              >
                                <SkipForward className="mr-1.5 h-3.5 w-3.5" />
                                Skip
                              </Button>
                              {currentStatus !== 'pending' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateResult(scenario.id, 'pending')}
                                >
                                  Reset
                                </Button>
                              )}
                              {result?.testedAt && (
                                <span className="ml-auto text-xs text-muted-foreground self-center">
                                  Tested: {new Date(result.testedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════

export default function ChatbotTestRunner() {
  const [tab, setTab] = useState('infra');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Chatbot Test Runner</h1>
        <p className="text-sm text-muted-foreground">
          Infrastructure checks and interactive QA scenarios for the AI chatbot system.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="infra" className="gap-2">
            <Cpu className="h-4 w-4" />
            Infrastructure Tests
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            QA Scenarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="infra" className="mt-6">
          <InfraTestsTab />
        </TabsContent>

        <TabsContent value="scenarios" className="mt-6">
          <ScenariosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
