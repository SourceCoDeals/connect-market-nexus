/**
 * ListingPipelineTest: In-platform diagnostic for the full listing creation pipeline.
 *
 * Runs live checks against the database to verify every step of:
 *   Deal → Push to Queue → Create Listing → Publish
 *
 * Can target a specific deal ID or pick a random queued deal.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  RotateCcw,
  Store,
} from 'lucide-react';
import { runPipelineChecks } from './listing-pipeline/runPipelineChecks';
import type { PipelineReport } from './listing-pipeline/runPipelineChecks';

// ─── Component ───

export default function ListingPipelineTest() {
  const [dealId, setDealId] = useState('');
  const [report, setReport] = useState<PipelineReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch a few queued deals for quick-pick
  const { data: queuedDeals } = useQuery({
    queryKey: ['pipeline-test-queued-deals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('listings')
        .select('id, internal_company_name, title, pushed_to_marketplace_at')
        .eq('pushed_to_marketplace', true)
        .eq('remarketing_status', 'active')
        .order('pushed_to_marketplace_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const runTest = async (targetDealId?: string) => {
    const id = targetDealId || dealId.trim();
    if (!id) return;
    setIsRunning(true);
    setReport(null);
    try {
      const result = await runPipelineChecks(id);
      setReport(result);
    } finally {
      setIsRunning(false);
    }
  };

  const passCount = report?.checks.filter((c) => c.status === 'pass').length || 0;
  const failCount = report?.checks.filter((c) => c.status === 'fail').length || 0;
  const warnCount = report?.checks.filter((c) => c.status === 'warn').length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="h-5 w-5" />
            Listing Pipeline Diagnostic
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tests the full pipeline: deal data &rarr; push gate &rarr; memo PDFs &rarr; listing
            creation &rarr; quality validation &rarr; publishing readiness.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual deal ID input */}
          <div className="flex gap-2">
            <Input
              placeholder="Paste a deal ID..."
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              className="max-w-md font-mono text-sm"
            />
            <Button onClick={() => runTest()} disabled={isRunning || !dealId.trim()}>
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Test
            </Button>
          </div>

          {/* Quick-pick from queued deals */}
          {queuedDeals && queuedDeals.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Quick pick from marketplace queue
              </p>
              <div className="flex flex-wrap gap-2">
                {queuedDeals.map(
                  (d: {
                    id: string;
                    internal_company_name: string | null;
                    title: string | null;
                  }) => (
                    <Button
                      key={d.id}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={isRunning}
                      onClick={() => {
                        setDealId(d.id);
                        runTest(d.id);
                      }}
                    >
                      {d.internal_company_name || d.title || d.id.slice(0, 8)}
                    </Button>
                  ),
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {report && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Results: {report.dealTitle}</CardTitle>
              <div className="flex items-center gap-2">
                {failCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    {failCount} failed
                  </Badge>
                )}
                {warnCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-700 border-amber-200 gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {warnCount} warnings
                  </Badge>
                )}
                {passCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {passCount} passed
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runTest(report.dealId)}
                  disabled={isRunning}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Re-run
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Deal ID: {report.dealId} &middot; Ran at {new Date(report.ranAt).toLocaleTimeString()}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.checks.map((check, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    check.status === 'fail'
                      ? 'bg-red-50/50 border-red-200 dark:bg-red-950/10'
                      : check.status === 'warn'
                        ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/10'
                        : check.status === 'pass'
                          ? 'bg-green-50/50 border-green-200 dark:bg-green-950/10'
                          : 'bg-muted/30'
                  }`}
                >
                  <div className="mt-0.5">
                    {check.status === 'pass' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {check.status === 'fail' && <XCircle className="h-4 w-4 text-red-600" />}
                    {check.status === 'warn' && (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    {check.status === 'running' && (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    )}
                    {check.status === 'pending' && (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{check.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                      {check.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
