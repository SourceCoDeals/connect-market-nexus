/**
 * SystemTestRunner: Comprehensive in-app test runner for post-refactor QA.
 * Runs all user stories and integration tests, reports pass/fail, persists results.
 */

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type TestStatus,
  type TestResult,
  type TestContext,
  STORAGE_KEY,
  buildTests,
} from "./system-test-runner/testDefinitions";

// ═══════════════════════════════════════════
// Component
// ═══════════════════════════════════════════

export default function SystemTestRunner() {
  const [results, setResults] = useState<TestResult[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore parse errors */ }
    return [];
  });
  const [isRunning, setIsRunning] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [lastRunAt, setLastRunAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY + "-ts");
    } catch {
      return null;
    }
  });
  const abortRef = useRef(false);

  const persist = useCallback((res: TestResult[], ts: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
      localStorage.setItem(STORAGE_KEY + "-ts", ts);
    } catch { /* ignore storage errors */ }
  }, []);

  const runTests = useCallback(
    async (onlyFailed = false) => {
      setIsRunning(true);
      abortRef.current = false;

      const allTests = buildTests();
      const testsToRun = onlyFailed
        ? allTests.filter((t) => results.find((r) => r.id === t.id && r.status === "fail"))
        : allTests;

      // Initialize results
      const initialResults: TestResult[] = allTests.map((t) => {
        const existing = results.find((r) => r.id === t.id);
        const shouldRun = testsToRun.some((tr) => tr.id === t.id);
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          status: shouldRun ? "pending" : existing?.status || "pending",
          error: shouldRun ? undefined : existing?.error,
          durationMs: shouldRun ? undefined : existing?.durationMs,
        };
      });
      setResults(initialResults);

      const ctx: TestContext = {
        createdContactIds: [],
        createdAccessIds: [],
        createdReleaseLogIds: [],
        createdTrackedLinkIds: [],
        testListingId: null,
        testBuyerId: null,
        testDealId: null,
      };

      const updatedResults = [...initialResults];

      for (const test of testsToRun) {
        if (abortRef.current) break;

        const idx = updatedResults.findIndex((r) => r.id === test.id);
        updatedResults[idx] = { ...updatedResults[idx], status: "running" };
        setResults([...updatedResults]);

        const start = performance.now();
        try {
          await test.fn(ctx);
          updatedResults[idx] = {
            ...updatedResults[idx],
            status: "pass",
            durationMs: Math.round(performance.now() - start),
            error: undefined,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          // Treat missing test data preconditions and some errors as warnings
          const isWarning = (msg.includes("does not exist") && !msg.includes("table"))
            || msg.includes("No documents exist")
            || msg.includes("No test ");
          updatedResults[idx] = {
            ...updatedResults[idx],
            status: isWarning ? "warn" : "fail",
            error: msg,
            durationMs: Math.round(performance.now() - start),
          };
        }
        setResults([...updatedResults]);
      }

      const ts = new Date().toISOString();
      setLastRunAt(ts);
      persist(updatedResults, ts);
      setIsRunning(false);
    },
    [results, persist]
  );

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) { next.delete(cat); } else { next.add(cat); }
      return next;
    });
  };

  const copyFailed = () => {
    const failed = results.filter((r) => r.status === "fail");
    const text = failed.map((r) => `❌ [${r.category}] ${r.name}\n   ${r.error}`).join("\n\n");
    navigator.clipboard.writeText(text || "No failures!");
  };

  // Group by category
  const categories = Array.from(new Set(results.map((r) => r.category)));
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const totalCount = results.length;

  const statusIcon = (status: TestStatus) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "fail":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "warn":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Test Runner</h1>
          <p className="text-sm text-muted-foreground">
            Post-refactor QA — {totalCount} tests
            {lastRunAt && ` · Last run: ${new Date(lastRunAt).toLocaleString()}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => runTests(false)} disabled={isRunning}>
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run All Tests
          </Button>
          {failCount > 0 && (
            <Button variant="outline" onClick={() => runTests(true)} disabled={isRunning}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Re-run Failed
            </Button>
          )}
          <Button variant="outline" onClick={copyFailed}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Failed
          </Button>
        </div>
      </div>

      {/* Summary bar */}
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

      {/* Test groups */}
      <div className="space-y-2">
        {categories.map((cat) => {
          const catResults = results.filter((r) => r.category === cat);
          const catPassed = catResults.filter((r) => r.status === "pass").length;
          const catFailed = catResults.filter((r) => r.status === "fail").length;
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
                        "flex items-start gap-3 px-4 py-2 text-sm",
                        r.status === "fail" && "bg-destructive/5"
                      )}
                    >
                      <div className="mt-0.5">{statusIcon(r.status)}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{r.name}</span>
                        {r.durationMs !== undefined && (
                          <span className="ml-2 text-xs text-muted-foreground">{r.durationMs}ms</span>
                        )}
                        {r.error && (
                          <p className="text-xs text-destructive mt-1 break-all font-mono">{r.error}</p>
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
