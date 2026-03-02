import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ChatbotTestResult,
  type ChatbotTestContext,
  CHATBOT_INFRA_STORAGE_KEY,
  buildChatbotTests,
} from '../chatbot-test-runner/chatbotInfraTests';
import { INTER_TEST_DELAY_MS, sleep, withRateLimitRetry } from '../system-test-runner/types';
import { loadStoredResults, saveToStorage } from './helpers';
import { StatusIcon } from './StatusIcon';

export function InfraTestsTab() {
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

      for (let i = 0; i < testsToRun.length; i++) {
        if (abortRef.current) break;
        const test = testsToRun[i];
        const idx = updated.findIndex((r) => r.id === test.id);
        updated[idx] = { ...updated[idx], status: 'running' };
        setResults([...updated]);

        const start = performance.now();
        try {
          await withRateLimitRetry(() => test.fn(ctx));
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

        // Small delay between tests to stay under Supabase rate limits
        if (i < testsToRun.length - 1 && !abortRef.current) {
          await sleep(INTER_TEST_DELAY_MS);
        }
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
                      <div className="mt-0.5">
                        <StatusIcon status={r.status} />
                      </div>
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
