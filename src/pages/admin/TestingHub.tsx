import { lazy, Suspense, useState, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  FlaskConical,
  Activity,
  Beaker,
  Bot,
  Mail,
  ListChecks,
  Store,
  Play,
  Download,
  Square,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { TestContext } from './system-test-runner/testDefinitions';
import type { ChatbotTestContext } from './chatbot-test-runner/chatbotInfraTests';

const EnrichmentTest = lazy(() => import('@/pages/admin/EnrichmentTest'));
const SystemTestRunner = lazy(() => import('@/pages/admin/SystemTestRunner'));
const DocuSealHealthCheck = lazy(() => import('@/pages/admin/DocuSealHealthCheck'));
const ChatbotTestRunner = lazy(() => import('@/pages/admin/ChatbotTestRunner'));
const SmartleadTestPage = lazy(() => import('@/pages/admin/SmartleadTestPage'));
const ThirtyQuestionTest = lazy(() => import('@/pages/admin/ThirtyQuestionTest'));
const ListingPipelineTest = lazy(() => import('@/pages/admin/ListingPipelineTest'));

const Loading = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

// localStorage keys — must match individual tab components
const SYSTEM_STORAGE_KEY = 'sourceco-system-test-results';
const DOCUSEAL_STORAGE_KEY = 'sourceco-docuseal-test-results';
const CHATBOT_INFRA_STORAGE_KEY = 'sourceco-chatbot-infra-test-results';
const SCENARIO_STORAGE_KEY = 'sourceco-chatbot-scenario-results';
const THIRTY_Q_STORAGE_KEY = 'sourceco-30q-test-results';

// Warning heuristics — must match individual tab components
const isSystemTestWarning = (msg: string) =>
  (msg.includes('does not exist') && !msg.includes('table')) ||
  msg.includes('No documents exist') ||
  msg.includes('No test ');

const isChatbotTestWarning = (msg: string) =>
  (msg.includes('does not exist') && !msg.includes('table')) ||
  msg.includes('empty') ||
  msg.includes('Expected multiple');

const SUITE_COUNT = 3;

interface RunAllProgress {
  suiteName: string;
  testIndex: number;
  testCount: number;
  suiteIndex: number;
  suiteCount: number;
}

/** Shared test-runner loop used by System Tests and Chatbot Infra suites. */
async function runTestLoop<Ctx>(opts: {
  tests: Array<{ id: string; name: string; category: string; fn: (ctx: Ctx) => Promise<void> }>;
  ctx: Ctx;
  storageKey: string;
  suiteName: string;
  isWarning: (msg: string) => boolean;
  suiteIndex: number;
  abortRef: { current: boolean };
  setProgress: (p: RunAllProgress) => void;
  jsonStringifyTs?: boolean;
}): Promise<void> {
  const {
    tests,
    ctx,
    storageKey,
    suiteName,
    isWarning,
    suiteIndex,
    abortRef,
    setProgress,
    jsonStringifyTs,
  } = opts;

  setProgress({
    suiteName,
    testIndex: 0,
    testCount: tests.length,
    suiteIndex,
    suiteCount: SUITE_COUNT,
  });

  const results = tests.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    status: 'pending' as const,
    error: undefined as string | undefined,
    durationMs: undefined as number | undefined,
  }));

  for (let i = 0; i < tests.length; i++) {
    if (abortRef.current) break;
    setProgress({
      suiteName,
      testIndex: i + 1,
      testCount: tests.length,
      suiteIndex,
      suiteCount: SUITE_COUNT,
    });

    const start = performance.now();
    try {
      await tests[i].fn(ctx);
      results[i] = {
        ...results[i],
        status: 'pass',
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results[i] = {
        ...results[i],
        status: isWarning(msg) ? 'warn' : 'fail',
        error: msg,
        durationMs: Math.round(performance.now() - start),
      };
    }
  }

  const ts = new Date().toISOString();
  localStorage.setItem(storageKey, JSON.stringify(results));
  localStorage.setItem(storageKey + '-ts', jsonStringifyTs ? JSON.stringify(ts) : ts);
}

export default function TestingHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'enrichment';
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [progress, setProgress] = useState<RunAllProgress | null>(null);
  const abortRef = useRef(false);

  const setTab = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  // ── Run All Automated Suites ──────────────────────────────────────
  // Runs System Tests, DocuSeal Health, and Chatbot Infra sequentially.
  // Suites that require user input (Enrichment, Smartlead, Listing Pipeline)
  // and long-running AI suites (30Q, Scenarios) are skipped.

  const runAllSuites = useCallback(async () => {
    setIsRunningAll(true);
    abortRef.current = false;
    let suiteIndex = 0;

    try {
      // Dynamic imports so we don't bloat the initial bundle
      const [testDefs, chatbotInfra] = await Promise.all([
        import('./system-test-runner/testDefinitions'),
        import('./chatbot-test-runner/chatbotInfraTests'),
      ]);

      // ─── Suite 1: System Tests ───
      if (!abortRef.current) {
        await runTestLoop({
          tests: testDefs.buildTests(),
          ctx: {
            createdContactIds: [],
            createdAccessIds: [],
            createdReleaseLogIds: [],
            createdTrackedLinkIds: [],
            testListingId: null,
            testBuyerId: null,
            testDealId: null,
          } as TestContext,
          storageKey: testDefs.STORAGE_KEY,
          suiteName: 'System Tests',
          isWarning: isSystemTestWarning,
          suiteIndex: suiteIndex++,
          abortRef,
          setProgress,
        });
      }

      // ─── Suite 2: DocuSeal Health Check ───
      if (!abortRef.current) {
        setProgress({
          suiteName: 'DocuSeal Health Check',
          testIndex: 1,
          testCount: 1,
          suiteIndex,
          suiteCount: SUITE_COUNT,
        });

        try {
          const { data, error } = await supabase.functions.invoke('docuseal-integration-test');
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          localStorage.setItem(DOCUSEAL_STORAGE_KEY, JSON.stringify(data));
          localStorage.setItem(
            DOCUSEAL_STORAGE_KEY + '-ts',
            data.ranAt || new Date().toISOString(),
          );
        } catch (err: unknown) {
          localStorage.setItem(
            DOCUSEAL_STORAGE_KEY,
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              results: [],
            }),
          );
          localStorage.setItem(DOCUSEAL_STORAGE_KEY + '-ts', new Date().toISOString());
        }
        suiteIndex++;
      }

      // ─── Suite 3: Chatbot Infrastructure Tests ───
      if (!abortRef.current) {
        await runTestLoop({
          tests: chatbotInfra.buildChatbotTests(),
          ctx: {
            createdConversationIds: [],
            createdAnalyticsIds: [],
            createdFeedbackIds: [],
          } as ChatbotTestContext,
          storageKey: chatbotInfra.CHATBOT_INFRA_STORAGE_KEY,
          suiteName: 'Chatbot Infrastructure',
          isWarning: isChatbotTestWarning,
          suiteIndex: suiteIndex++,
          abortRef,
          setProgress,
          jsonStringifyTs: true,
        });
      }

      toast.success(
        `Run All complete — ${suiteIndex} suite${suiteIndex !== 1 ? 's' : ''} finished`,
      );
    } catch (err: unknown) {
      toast.error(`Run All failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunningAll(false);
      setProgress(null);
    }
  }, []);

  const stopRunAll = useCallback(() => {
    abortRef.current = true;
  }, []);

  // ── Export All Results as JSON ─────────────────────────────────────
  // Collects results from all suites stored in localStorage and downloads
  // a single JSON report suitable for uploading to Claude Code for feedback.

  const exportAllResults = useCallback(() => {
    const suites: Record<string, unknown> = {};

    const summarize = (results: Array<{ status: string }>) => ({
      total: results.length,
      pass: results.filter((r) => r.status === 'pass').length,
      fail: results.filter((r) => r.status === 'fail').length,
      warn: results.filter((r) => r.status === 'warn').length,
      skip: results.filter((r) => r.status === 'skip').length,
    });

    const readTs = (key: string): string | null => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };

    // System Tests
    try {
      const raw = localStorage.getItem(SYSTEM_STORAGE_KEY);
      if (raw) {
        const results = JSON.parse(raw);
        suites.systemTests = {
          name: 'System Tests',
          lastRunAt: readTs(SYSTEM_STORAGE_KEY + '-ts'),
          summary: summarize(results),
          results,
        };
      }
    } catch {
      /* skip */
    }

    // DocuSeal Health Check
    try {
      const raw = localStorage.getItem(DOCUSEAL_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        suites.docuSealHealth = {
          name: 'DocuSeal Health Check',
          lastRunAt: readTs(DOCUSEAL_STORAGE_KEY + '-ts') || data.ranAt,
          ...(data.error
            ? { error: data.error }
            : {
                summary: summarize(data.results || []),
                results: data.results || [],
                cleanup: data.cleanup,
              }),
        };
      }
    } catch {
      /* skip */
    }

    // Chatbot Infrastructure Tests
    try {
      const raw = localStorage.getItem(CHATBOT_INFRA_STORAGE_KEY);
      if (raw) {
        const results = JSON.parse(raw);
        suites.chatbotInfrastructure = {
          name: 'Chatbot Infrastructure Tests',
          lastRunAt: readTs(CHATBOT_INFRA_STORAGE_KEY + '-ts'),
          summary: summarize(results),
          results,
        };
      }
    } catch {
      /* skip */
    }

    // Chatbot QA Scenarios
    try {
      const raw = localStorage.getItem(SCENARIO_STORAGE_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        const results = Object.values(map) as Array<{ status: string }>;
        suites.chatbotScenarios = {
          name: 'Chatbot QA Scenarios',
          summary: summarize(results),
          results: map,
        };
      }
    } catch {
      /* skip */
    }

    // 30-Question QA
    try {
      const raw = localStorage.getItem(THIRTY_Q_STORAGE_KEY);
      if (raw) {
        const results = JSON.parse(raw);
        suites.thirtyQuestionQA = {
          name: '30-Question QA',
          lastRunAt: readTs(THIRTY_Q_STORAGE_KEY + '-ts'),
          summary: summarize(results),
          results,
        };
      }
    } catch {
      /* skip */
    }

    if (Object.keys(suites).length === 0) {
      toast.error('No test results found. Run some tests first.');
      return;
    }

    const report = {
      exportedAt: new Date().toISOString(),
      platform: 'SourceCo Connect – Testing & Diagnostics',
      suites,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${new Date().toISOString().slice(0, 10)}.json`;
    a.style.visibility = 'hidden';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${Object.keys(suites).length} suite(s) to JSON`);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Testing & Diagnostics</h1>
              <p className="text-sm text-muted-foreground">
                Enrichment tests, system integration tests, DocuSeal health checks, Smartlead
                integration, and AI chatbot QA.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isRunningAll ? (
                <Button variant="destructive" onClick={stopRunAll} className="gap-2">
                  <Square className="h-4 w-4" />
                  Stop All
                </Button>
              ) : (
                <Button onClick={runAllSuites} className="gap-2">
                  <Play className="h-4 w-4" />
                  Run All Suites
                </Button>
              )}
              <Button
                variant="outline"
                onClick={exportAllResults}
                disabled={isRunningAll}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export Results
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Run All progress bar */}
      {progress && (
        <div className="border-b bg-muted/30 px-8 py-3">
          <div className="flex items-center gap-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{progress.suiteName}</span>
                <span className="text-muted-foreground text-xs">
                  Suite {progress.suiteIndex + 1}/{progress.suiteCount}
                  {progress.testCount > 1 && ` · Test ${progress.testIndex}/${progress.testCount}`}
                </span>
              </div>
              <Progress
                value={
                  ((progress.suiteIndex + progress.testIndex / Math.max(progress.testCount, 1)) /
                    progress.suiteCount) *
                  100
                }
                className="h-2"
              />
            </div>
          </div>
        </div>
      )}

      <div className="px-8 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="enrichment" className="gap-2">
              <Beaker className="h-4 w-4" />
              Enrichment Test
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              System Tests
            </TabsTrigger>
            <TabsTrigger value="docuseal" className="gap-2">
              <Activity className="h-4 w-4" />
              DocuSeal Health
            </TabsTrigger>
            <TabsTrigger value="smartlead" className="gap-2">
              <Mail className="h-4 w-4" />
              Smartlead
            </TabsTrigger>
            <TabsTrigger value="chatbot" className="gap-2">
              <Bot className="h-4 w-4" />
              AI Chatbot
            </TabsTrigger>
            <TabsTrigger value="30q" className="gap-2">
              <ListChecks className="h-4 w-4" />
              30-Question QA
            </TabsTrigger>
            <TabsTrigger value="listing-pipeline" className="gap-2">
              <Store className="h-4 w-4" />
              Listing Pipeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enrichment">
            <Suspense fallback={<Loading />}>
              <EnrichmentTest />
            </Suspense>
          </TabsContent>

          <TabsContent value="system">
            <Suspense fallback={<Loading />}>
              <SystemTestRunner />
            </Suspense>
          </TabsContent>

          <TabsContent value="docuseal">
            <Suspense fallback={<Loading />}>
              <DocuSealHealthCheck />
            </Suspense>
          </TabsContent>

          <TabsContent value="smartlead">
            <Suspense fallback={<Loading />}>
              <SmartleadTestPage />
            </Suspense>
          </TabsContent>

          <TabsContent value="chatbot">
            <Suspense fallback={<Loading />}>
              <ChatbotTestRunner />
            </Suspense>
          </TabsContent>

          <TabsContent value="30q">
            <Suspense fallback={<Loading />}>
              <ThirtyQuestionTest />
            </Suspense>
          </TabsContent>

          <TabsContent value="listing-pipeline">
            <Suspense fallback={<Loading />}>
              <ListingPipelineTest />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
