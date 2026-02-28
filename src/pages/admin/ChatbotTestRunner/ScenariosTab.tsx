import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Copy,
  ChevronDown,
  ChevronRight,
  Loader2,
  SkipForward,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sendAIQuery } from '../chatbot-test-runner/chatbotInfraTests';
import {
  type ScenarioResult,
  type ScenarioStatus,
  SCENARIO_STORAGE_KEY,
  getChatbotTestScenarios,
  runAutoChecks,
} from '../chatbot-test-runner/chatbotTestScenarios';
import { loadStoredResults, saveToStorage, severityColor } from './helpers';
import { StatusIcon } from './StatusIcon';

export function ScenariosTab() {
  const scenarios = getChatbotTestScenarios();
  const [scenarioResults, setScenarioResults] = useState<Record<string, ScenarioResult>>(() =>
    loadStoredResults(SCENARIO_STORAGE_KEY, {}),
  );
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const runScenarios = useCallback(
    async (onlyFailed = false) => {
      setIsRunning(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const runnable = scenarios.filter((s) => !s.skipAutoRun);
      const toRun = onlyFailed
        ? runnable.filter((s) => scenarioResults[s.id]?.status === 'fail')
        : runnable;

      setRunProgress({ current: 0, total: toRun.length });

      for (let i = 0; i < toRun.length; i++) {
        if (controller.signal.aborted) break;
        const scenario = toRun[i];
        setRunProgress({ current: i + 1, total: toRun.length });

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
          const response = await sendAIQuery(scenario.userMessage, 45000, controller.signal);
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
          if (controller.signal.aborted) break;
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
      setRunProgress(null);
      abortControllerRef.current = null;
    },
    [scenarios, scenarioResults],
  );

  const stopRun = useCallback(() => {
    abortControllerRef.current?.abort();
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

  const total = scenarios.length;
  const passCount = scenarios.filter((s) => scenarioResults[s.id]?.status === 'pass').length;
  const failCount = scenarios.filter((s) => scenarioResults[s.id]?.status === 'fail').length;
  const skipCount = scenarios.filter((s) => scenarioResults[s.id]?.status === 'skip').length;
  const pendingCount = total - passCount - failCount - skipCount;

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
              {runProgress ? `Stop (${runProgress.current}/${runProgress.total})` : 'Stop'}
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
                          <div className="mt-0.5"><StatusIcon status={currentStatus} /></div>
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

                            <div className="rounded-md bg-muted p-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Test Message:
                              </p>
                              <p className="text-sm font-mono">{scenario.userMessage}</p>
                            </div>

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

                            {result?.error && (
                              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                                <p className="text-sm text-destructive font-mono">{result.error}</p>
                              </div>
                            )}

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
