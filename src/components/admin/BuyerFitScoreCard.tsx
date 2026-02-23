import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calculator, Shield, Clock, AlertTriangle } from 'lucide-react';
import { BuyerTierBadge, PlatformSignalBadge } from './BuyerFitScoreBadge';
import {
  useRecalculateBuyerFitScore,
  useAdminTierOverride,
} from '@/hooks/admin/use-buyer-fit-score';
import type { BuyerFitScoreResult } from '@/hooks/admin/use-buyer-fit-score';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface BuyerFitScoreCardProps {
  profileId: string;
  buyerFitScore?: number | null;
  buyerFitTier?: number | null;
  platformSignalDetected?: boolean;
  platformSignalSource?: string | null;
  buyerFitScoreLastCalculated?: string | null;
  adminTierOverride?: number | null;
  adminOverrideNote?: string | null;
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {score}/{max}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 70
              ? 'bg-emerald-500'
              : pct >= 45
                ? 'bg-blue-500'
                : pct >= 25
                  ? 'bg-amber-500'
                  : 'bg-red-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function BuyerFitScoreCard({
  profileId,
  buyerFitScore,
  buyerFitTier,
  platformSignalDetected,
  platformSignalSource,
  buyerFitScoreLastCalculated,
  adminTierOverride,
  adminOverrideNote,
}: BuyerFitScoreCardProps) {
  const recalculate = useRecalculateBuyerFitScore();
  const overrideMutation = useAdminTierOverride();
  const [scoreResult, setScoreResult] = useState<BuyerFitScoreResult | null>(null);
  const [overrideTier, setOverrideTier] = useState<string>(
    adminTierOverride ? String(adminTierOverride) : 'none',
  );
  const [overrideNote, setOverrideNote] = useState(adminOverrideNote || '');
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  const handleRecalculate = async () => {
    const result = await recalculate.mutateAsync({ profileId });
    setScoreResult(result);
  };

  const handleSaveOverride = () => {
    const tier = overrideTier === 'none' ? null : parseInt(overrideTier);
    overrideMutation.mutate({
      profileId,
      tierOverride: tier,
      overrideNote,
    });
    setShowOverrideForm(false);
  };

  // Use either the fresh result from recalculation or the stored values
  const displayScore = scoreResult?.total_score ?? buyerFitScore;
  const displayTier = scoreResult?.tier ?? buyerFitTier;
  const breakdown = scoreResult?.component_breakdown;
  const lastCalculated = scoreResult?.calculated_at ?? buyerFitScoreLastCalculated;
  const signalDetected = scoreResult?.platform_signal_detected ?? platformSignalDetected;
  const signalSource = scoreResult?.platform_signal_source ?? platformSignalSource;

  function getScoreBgColor(score: number): string {
    if (score >= 70) return 'text-emerald-700';
    if (score >= 45) return 'text-blue-700';
    if (score >= 15) return 'text-amber-700';
    return 'text-red-700';
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Buyer Fit Score
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculate.isPending}
            className="h-7 text-xs gap-1.5"
          >
            <Calculator className="h-3 w-3" />
            {recalculate.isPending ? 'Calculating...' : 'Recalculate'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayScore != null ? (
          <>
            {/* Main score display */}
            <div className="flex items-center gap-4">
              <div className={cn('text-4xl font-bold', getScoreBgColor(displayScore))}>
                {displayScore}
              </div>
              <div className="flex-1 space-y-1">
                <BuyerTierBadge tier={displayTier} size="md" showLabel />
                {signalDetected && (
                  <div className="mt-1">
                    <PlatformSignalBadge detected={signalDetected} source={signalSource} />
                  </div>
                )}
              </div>
            </div>

            {/* Score breakdown — only shows after recalculation */}
            {breakdown && (
              <div className="space-y-2 pt-2 border-t">
                <ScoreBar label="Buyer Type" score={breakdown.buyer_type} max={40} />
                <ScoreBar label="Platform Signal" score={breakdown.platform_signal} max={30} />
                <ScoreBar
                  label="Capital Credibility"
                  score={breakdown.capital_credibility}
                  max={20}
                />
                <ScoreBar
                  label="Profile Completeness"
                  score={breakdown.profile_completeness}
                  max={10}
                />
              </div>
            )}

            {/* Platform keywords matched */}
            {scoreResult?.platform_keywords_matched &&
              scoreResult.platform_keywords_matched.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Platform keywords matched:</p>
                  <div className="flex flex-wrap gap-1">
                    {scoreResult.platform_keywords_matched.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Admin override */}
            {adminTierOverride && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">
                  Admin override: Tier {adminTierOverride}
                </span>
                {adminOverrideNote && (
                  <span className="text-xs text-muted-foreground">— {adminOverrideNote}</span>
                )}
              </div>
            )}

            {/* Last calculated */}
            {lastCalculated && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Scored {formatDistanceToNow(new Date(lastCalculated), { addSuffix: true })}
              </div>
            )}

            {/* Override section */}
            {!showOverrideForm ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOverrideForm(true)}
                className="text-xs h-7"
              >
                {adminTierOverride ? 'Edit Override' : 'Set Manual Override'}
              </Button>
            ) : (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <Label className="text-xs">Override Tier</Label>
                  <Select value={overrideTier} onValueChange={setOverrideTier}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Override (use algorithm)</SelectItem>
                      <SelectItem value="1">Tier 1 — Platform + Add-On</SelectItem>
                      <SelectItem value="2">Tier 2 — Committed Capital</SelectItem>
                      <SelectItem value="3">Tier 3 — Indep. Sponsor / Search</SelectItem>
                      <SelectItem value="4">Tier 4 — Unverified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Override Note</Label>
                  <Textarea
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    placeholder="Reason for override..."
                    className="h-16 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveOverride}
                    disabled={overrideMutation.isPending}
                    className="h-7 text-xs"
                  >
                    Save Override
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowOverrideForm(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">Score not yet calculated</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculate.isPending}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {recalculate.isPending ? 'Calculating...' : 'Calculate Score'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
