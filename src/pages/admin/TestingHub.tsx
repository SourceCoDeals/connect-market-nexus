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
const ENRICHMENT_STORAGE_KEY = 'sourceco-enrichment-test-results';
const PIPELINE_STORAGE_KEY = 'sourceco-pipeline-test-results';
const SMARTLEAD_STORAGE_KEY = 'sourceco-smartlead-test-results';

// Warning heuristics — must match individual tab components
const isSystemTestWarning = (msg: string) =>
  (msg.includes('does not exist') && !msg.includes('table')) ||
  msg.includes('No documents exist') ||
  msg.includes('No test ');

const isChatbotTestWarning = (msg: string) =>
  (msg.includes('does not exist') && !msg.includes('table')) ||
  msg.includes('empty') ||
  msg.includes('Expected multiple');

const SUITE_COUNT = 8;

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

  // ── Run All Suites ───────────────────────────────────────────────
  // Runs all 8 suites sequentially, auto-selecting test data where needed.

  const runAllSuites = useCallback(async () => {
    setIsRunningAll(true);
    abortRef.current = false;
    let suiteIndex = 0;

    try {
      // Dynamic imports so we don't bloat the initial bundle
      const [testDefs, chatbotInfra, pipelineMod, thirtyQMod, scenarioMod] = await Promise.all([
        import('./system-test-runner/testDefinitions'),
        import('./chatbot-test-runner/chatbotInfraTests'),
        import('./listing-pipeline/runPipelineChecks'),
        import('./chatbot-test-runner/thirtyQuestionSuite'),
        import('./chatbot-test-runner/chatbotTestScenarios'),
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

      // ─── Suite 4: Enrichment (auto-selected deal + buyer) ───
      if (!abortRef.current) {
        setProgress({
          suiteName: 'Enrichment (auto-select)',
          testIndex: 0,
          testCount: 4,
          suiteIndex,
          suiteCount: SUITE_COUNT,
        });

        const enrichResults: Array<{
          id: string;
          name: string;
          status: string;
          detail: string;
          durationMs?: number;
        }> = [];

        try {
          // Step 1: Auto-select a deal (prefer unenriched)
          setProgress({
            suiteName: 'Enrichment',
            testIndex: 1,
            testCount: 4,
            suiteIndex,
            suiteCount: SUITE_COUNT,
          });
          let { data: deals } = await supabase
            .from('listings')
            .select('id, title, internal_company_name')
            .is('enriched_at', null)
            .limit(50);
          if (!deals?.length) {
            const res = await supabase
              .from('listings')
              .select('id, title, internal_company_name')
              .limit(50);
            deals = res.data;
          }
          const deal = deals?.length ? deals[Math.floor(Math.random() * deals.length)] : null;

          // Auto-select a buyer (prefer unenriched)
          let { data: buyers } = await supabase
            .from('remarketing_buyers')
            .select('id, company_name')
            .is('data_last_updated', null)
            .limit(50);
          if (!buyers?.length) {
            const res = await supabase
              .from('remarketing_buyers')
              .select('id, company_name')
              .limit(50);
            buyers = res.data;
          }
          const buyer = buyers?.length ? buyers[Math.floor(Math.random() * buyers.length)] : null;

          if (!deal) {
            enrichResults.push({
              id: 'auto-select',
              name: 'Auto-select test data',
              status: 'fail',
              detail: 'No deals found in the database',
            });
          } else {
            enrichResults.push({
              id: 'auto-select',
              name: 'Auto-select test data',
              status: 'pass',
              detail: `Deal: ${deal.internal_company_name || deal.title || deal.id}${buyer ? ` | Buyer: ${buyer.company_name || buyer.id}` : ' | No buyers found'}`,
            });

            // Step 2: Queue deal enrichment + poll
            if (!abortRef.current) {
              setProgress({
                suiteName: 'Enrichment – Deal',
                testIndex: 2,
                testCount: 4,
                suiteIndex,
                suiteCount: SUITE_COUNT,
              });
              const start = performance.now();
              try {
                const { queueDealEnrichment } = await import('@/lib/remarketing/queueEnrichment');
                await queueDealEnrichment([deal.id]);
                let attempts = 0;
                let done = false;
                while (attempts < 45 && !done && !abortRef.current) {
                  await new Promise((r) => setTimeout(r, 4000));
                  attempts++;
                  const { data: q } = await supabase
                    .from('enrichment_queue')
                    .select('status')
                    .eq('listing_id', deal.id)
                    .order('queued_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (q?.status === 'completed' || q?.status === 'failed') done = true;
                }
                const ms = Math.round(performance.now() - start);
                enrichResults.push({
                  id: 'deal-enrich',
                  name: 'Deal enrichment',
                  status: done ? 'pass' : abortRef.current ? 'skip' : 'warn',
                  detail: done
                    ? `Completed in ${attempts} poll cycles`
                    : abortRef.current
                      ? 'Aborted'
                      : `Timed out after ${attempts} polls`,
                  durationMs: ms,
                });
              } catch (err: unknown) {
                enrichResults.push({
                  id: 'deal-enrich',
                  name: 'Deal enrichment',
                  status: 'fail',
                  detail: err instanceof Error ? err.message : String(err),
                  durationMs: Math.round(performance.now() - start),
                });
              }
            }

            // Step 3: Queue buyer enrichment + poll
            if (!abortRef.current && buyer) {
              setProgress({
                suiteName: 'Enrichment – Buyer',
                testIndex: 3,
                testCount: 4,
                suiteIndex,
                suiteCount: SUITE_COUNT,
              });
              const start = performance.now();
              try {
                const { queueBuyerEnrichment } = await import('@/lib/remarketing/queueEnrichment');
                await queueBuyerEnrichment([buyer.id]);
                let attempts = 0;
                let done = false;
                while (attempts < 45 && !done && !abortRef.current) {
                  await new Promise((r) => setTimeout(r, 4000));
                  attempts++;
                  const { data: q } = await supabase
                    .from('buyer_enrichment_queue')
                    .select('status')
                    .eq('buyer_id', buyer.id)
                    .order('queued_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (q?.status === 'completed' || q?.status === 'failed') done = true;
                }
                const ms = Math.round(performance.now() - start);
                enrichResults.push({
                  id: 'buyer-enrich',
                  name: 'Buyer enrichment',
                  status: done ? 'pass' : abortRef.current ? 'skip' : 'warn',
                  detail: done
                    ? `Completed in ${attempts} poll cycles`
                    : abortRef.current
                      ? 'Aborted'
                      : `Timed out after ${attempts} polls`,
                  durationMs: ms,
                });
              } catch (err: unknown) {
                enrichResults.push({
                  id: 'buyer-enrich',
                  name: 'Buyer enrichment',
                  status: 'fail',
                  detail: err instanceof Error ? err.message : String(err),
                  durationMs: Math.round(performance.now() - start),
                });
              }
            }

            // Step 4: Deal quality scoring
            if (!abortRef.current) {
              setProgress({
                suiteName: 'Enrichment – Scoring',
                testIndex: 4,
                testCount: 4,
                suiteIndex,
                suiteCount: SUITE_COUNT,
              });
              const start = performance.now();
              try {
                const { queueDealQualityScoring } = await import('@/lib/remarketing/queueScoring');
                const scoreResult = await queueDealQualityScoring({ listingIds: [deal.id] });
                enrichResults.push({
                  id: 'scoring',
                  name: 'Deal quality scoring',
                  status: scoreResult.errors === 0 ? 'pass' : 'warn',
                  detail: `Scored: ${scoreResult.scored}, Errors: ${scoreResult.errors}`,
                  durationMs: Math.round(performance.now() - start),
                });
              } catch (err: unknown) {
                enrichResults.push({
                  id: 'scoring',
                  name: 'Deal quality scoring',
                  status: 'fail',
                  detail: err instanceof Error ? err.message : String(err),
                  durationMs: Math.round(performance.now() - start),
                });
              }
            }
          }
        } catch (err: unknown) {
          enrichResults.push({
            id: 'enrichment-error',
            name: 'Enrichment suite',
            status: 'fail',
            detail: err instanceof Error ? err.message : String(err),
          });
        }

        const ts = new Date().toISOString();
        localStorage.setItem(ENRICHMENT_STORAGE_KEY, JSON.stringify(enrichResults));
        localStorage.setItem(ENRICHMENT_STORAGE_KEY + '-ts', ts);
        suiteIndex++;
      }

      // ─── Suite 5: Listing Pipeline (auto-selected pushed deal) ───
      if (!abortRef.current) {
        setProgress({
          suiteName: 'Listing Pipeline',
          testIndex: 1,
          testCount: 1,
          suiteIndex,
          suiteCount: SUITE_COUNT,
        });

        try {
          // Auto-select a recently pushed deal
          const { data: pushedDeals } = await supabase
            .from('listings')
            .select('id, internal_company_name, title')
            .eq('pushed_to_marketplace', true)
            .eq('remarketing_status', 'active')
            .order('pushed_to_marketplace_at', { ascending: false })
            .limit(5);

          if (!pushedDeals?.length) {
            // Fall back to any deal
            const { data: anyDeal } = await supabase
              .from('listings')
              .select('id')
              .limit(1)
              .maybeSingle();
            if (anyDeal) {
              const report = await pipelineMod.runPipelineChecks(anyDeal.id);
              localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(report));
            } else {
              localStorage.setItem(
                PIPELINE_STORAGE_KEY,
                JSON.stringify({ error: 'No deals found', checks: [] }),
              );
            }
          } else {
            const pick = pushedDeals[Math.floor(Math.random() * pushedDeals.length)];
            const report = await pipelineMod.runPipelineChecks(pick.id);
            localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(report));
          }
        } catch (err: unknown) {
          localStorage.setItem(
            PIPELINE_STORAGE_KEY,
            JSON.stringify({ error: err instanceof Error ? err.message : String(err), checks: [] }),
          );
        }

        localStorage.setItem(PIPELINE_STORAGE_KEY + '-ts', new Date().toISOString());
        suiteIndex++;
      }

      // ─── Suite 6: Smartlead Diagnostics (DB-only checks) ───
      if (!abortRef.current) {
        setProgress({
          suiteName: 'Smartlead Diagnostics',
          testIndex: 0,
          testCount: 3,
          suiteIndex,
          suiteCount: SUITE_COUNT,
        });
        const slResults: Array<{
          id: string;
          name: string;
          status: string;
          detail: string;
          durationMs?: number;
        }> = [];

        // Campaign tables
        setProgress({
          suiteName: 'Smartlead Diagnostics',
          testIndex: 1,
          testCount: 3,
          suiteIndex,
          suiteCount: SUITE_COUNT,
        });
        const s1 = performance.now();
        const { data: campaigns, error: campErr } = await supabase
          .from('smartlead_campaigns')
          .select('id, name, status, lead_count, smartlead_campaign_id, created_at, last_synced_at')
          .order('created_at', { ascending: false })
          .limit(10);
        slResults.push({
          id: 'campaigns',
          name: 'Campaign database tables',
          status: campErr ? 'fail' : 'pass',
          detail: campErr ? campErr.message : `${campaigns?.length || 0} campaign(s) found`,
          durationMs: Math.round(performance.now() - s1),
        });

        // Campaign stats
        if (!abortRef.current) {
          setProgress({
            suiteName: 'Smartlead Diagnostics',
            testIndex: 2,
            testCount: 3,
            suiteIndex,
            suiteCount: SUITE_COUNT,
          });
          const s2 = performance.now();
          const { data: stats, error: statsErr } = await supabase
            .from('smartlead_campaign_stats')
            .select('*')
            .limit(5);
          slResults.push({
            id: 'stats',
            name: 'Campaign stats table',
            status: statsErr ? 'fail' : 'pass',
            detail: statsErr ? statsErr.message : `${stats?.length || 0} stat snapshot(s)`,
            durationMs: Math.round(performance.now() - s2),
          });
        }

        // Webhook events
        if (!abortRef.current) {
          setProgress({
            suiteName: 'Smartlead Diagnostics',
            testIndex: 3,
            testCount: 3,
            suiteIndex,
            suiteCount: SUITE_COUNT,
          });
          const s3 = performance.now();
          const { data: events, error: evtErr } = await supabase
            .from('smartlead_webhook_events')
            .select('id, event_type, lead_email, processed, created_at')
            .order('created_at', { ascending: false })
            .limit(20);
          if (evtErr) {
            slResults.push({
              id: 'webhooks',
              name: 'Webhook events',
              status: 'fail',
              detail: evtErr.message,
              durationMs: Math.round(performance.now() - s3),
            });
          } else {
            const summary: Record<string, number> = {};
            for (const evt of events || [])
              summary[evt.event_type] = (summary[evt.event_type] || 0) + 1;
            slResults.push({
              id: 'webhooks',
              name: 'Webhook events',
              status: 'pass',
              detail: `${events?.length || 0} event(s)${
                Object.keys(summary).length > 0
                  ? `: ${Object.entries(summary)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')}`
                  : ''
              }`,
              durationMs: Math.round(performance.now() - s3),
            });
          }
        }

        localStorage.setItem(SMARTLEAD_STORAGE_KEY, JSON.stringify(slResults));
        localStorage.setItem(SMARTLEAD_STORAGE_KEY + '-ts', new Date().toISOString());
        suiteIndex++;
      }

      // ─── Suite 7: 30-Question QA (35 AI calls) ───
      if (!abortRef.current) {
        const questions = thirtyQMod.THIRTY_Q_SUITE;
        const qResults: Array<{
          question: { id: number; category: string; question: string };
          status: string;
          actualResponse: string;
          routeCategory: string;
          tools: string[];
          durationMs: number;
          score?: unknown;
        }> = [];

        for (let i = 0; i < questions.length; i++) {
          if (abortRef.current) break;
          setProgress({
            suiteName: '30-Question QA',
            testIndex: i + 1,
            testCount: questions.length,
            suiteIndex,
            suiteCount: SUITE_COUNT,
          });

          const q = questions[i];
          const start = performance.now();
          try {
            const res = await chatbotInfra.sendAIQuery(q.question, 60000);
            const durationMs = Math.round(performance.now() - start);
            const toolNames = res.toolCalls.map((t: { name: string }) => t.name);
            const routeCategory = res.routeInfo?.category || 'unknown';
            const hasResponse = !!(res.text && res.text.trim().length > 0);
            const hasError = !!res.error;
            const score = thirtyQMod.scoreThirtyQResponse(q, {
              text: res.text || '',
              tools: toolNames,
              routeCategory,
              error: res.error || undefined,
              durationMs,
            });
            qResults.push({
              question: { id: q.id, category: q.category, question: q.question },
              status: hasError ? 'fail' : hasResponse ? 'pass' : 'fail',
              actualResponse: res.text || res.error || '(empty)',
              routeCategory,
              tools: toolNames,
              durationMs,
              score,
            });
          } catch (err: unknown) {
            qResults.push({
              question: { id: q.id, category: q.category, question: q.question },
              status: 'fail',
              actualResponse: err instanceof Error ? err.message : String(err),
              routeCategory: '',
              tools: [],
              durationMs: Math.round(performance.now() - start),
            });
          }
        }

        localStorage.setItem(THIRTY_Q_STORAGE_KEY, JSON.stringify(qResults));
        localStorage.setItem(THIRTY_Q_STORAGE_KEY + '-ts', new Date().toISOString());
        suiteIndex++;
      }

      // ─── Suite 8: Chatbot Scenarios (126+ AI calls) ───
      if (!abortRef.current) {
        const allScenarios = scenarioMod.getChatbotTestScenarios();
        const autoScenarios = allScenarios.filter((s: { skipAutoRun?: boolean }) => !s.skipAutoRun);
        const scenarioResults: Record<string, unknown> = {};

        for (let i = 0; i < autoScenarios.length; i++) {
          if (abortRef.current) break;
          setProgress({
            suiteName: 'Chatbot Scenarios',
            testIndex: i + 1,
            testCount: autoScenarios.length,
            suiteIndex,
            suiteCount: SUITE_COUNT,
          });

          const scenario = autoScenarios[i];
          const start = performance.now();
          try {
            const res = await chatbotInfra.sendAIQuery(scenario.userMessage, 45000);
            const durationMs = Math.round(performance.now() - start);
            const toolNames = res.toolCalls.map((t: { name: string }) => t.name);
            const routeCategory = res.routeInfo?.category || 'unknown';
            const autoChecks = scenarioMod.runAutoChecks(scenario, {
              text: res.text || '',
              toolCalls: res.toolCalls,
              routeInfo: res.routeInfo,
              error: res.error,
            });
            const allPassed = autoChecks.every((c: { passed: boolean }) => c.passed);
            scenarioResults[scenario.id] = {
              id: scenario.id,
              status: allPassed ? 'pass' : 'fail',
              notes: '',
              testedAt: new Date().toISOString(),
              aiResponse: res.text || res.error || '(empty)',
              toolsCalled: toolNames,
              routeCategory,
              durationMs,
              autoChecks,
            };
          } catch (err: unknown) {
            scenarioResults[scenario.id] = {
              id: scenario.id,
              status: 'fail',
              notes: '',
              testedAt: new Date().toISOString(),
              error: err instanceof Error ? err.message : String(err),
              durationMs: Math.round(performance.now() - start),
            };
          }
        }

        localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenarioResults));
        suiteIndex++;
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

    // Enrichment Test
    try {
      const raw = localStorage.getItem(ENRICHMENT_STORAGE_KEY);
      if (raw) {
        const results = JSON.parse(raw);
        suites.enrichmentTest = {
          name: 'Enrichment Test (auto-selected)',
          lastRunAt: readTs(ENRICHMENT_STORAGE_KEY + '-ts'),
          summary: summarize(results),
          results,
        };
      }
    } catch {
      /* skip */
    }

    // Listing Pipeline
    try {
      const raw = localStorage.getItem(PIPELINE_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.error) {
          suites.listingPipeline = {
            name: 'Listing Pipeline',
            lastRunAt: readTs(PIPELINE_STORAGE_KEY + '-ts'),
            error: data.error,
          };
        } else {
          suites.listingPipeline = {
            name: 'Listing Pipeline',
            lastRunAt: readTs(PIPELINE_STORAGE_KEY + '-ts') || data.ranAt,
            dealId: data.dealId,
            dealTitle: data.dealTitle,
            summary: summarize(data.checks || []),
            checks: data.checks,
          };
        }
      }
    } catch {
      /* skip */
    }

    // Smartlead Diagnostics
    try {
      const raw = localStorage.getItem(SMARTLEAD_STORAGE_KEY);
      if (raw) {
        const results = JSON.parse(raw);
        suites.smartleadDiagnostics = {
          name: 'Smartlead Diagnostics',
          lastRunAt: readTs(SMARTLEAD_STORAGE_KEY + '-ts'),
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
