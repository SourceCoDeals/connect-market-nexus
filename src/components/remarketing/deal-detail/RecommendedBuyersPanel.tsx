import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNewRecommendedBuyers,
  type BuyerScore,
} from '@/hooks/admin/use-new-recommended-buyers';
import { useSeedBuyers, type SeedBuyerResult } from '@/hooks/admin/use-seed-buyers';
import {
  RefreshCw,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Zap,
  Star,
  HelpCircle,
  Building2,
  MapPin,
  FileCheck,
  Sparkles,
  Plus,
  Check,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RecommendedBuyersPanelProps {
  listingId: string;
}

const PAGE_SIZE = 5;

const TIER_CONFIG: Record<BuyerScore['tier'], { label: string; color: string; icon: typeof Zap }> = {
  move_now: { label: 'Move Now', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Zap },
  strong: { label: 'Strong', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Star },
  speculative: { label: 'Speculative', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: HelpCircle },
};

function TierSummary({ buyers }: { buyers: BuyerScore[] }) {
  const moveNow = buyers.filter(b => b.tier === 'move_now').length;
  const strong = buyers.filter(b => b.tier === 'strong').length;
  const speculative = buyers.filter(b => b.tier === 'speculative').length;

  return (
    <div className="flex items-center gap-4 text-sm">
      {moveNow > 0 && (
        <span className="flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-medium text-emerald-700">{moveNow}</span> Move Now
        </span>
      )}
      {strong > 0 && (
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-blue-600" />
          <span className="font-medium text-blue-700">{strong}</span> Strong
        </span>
      )}
      {speculative > 0 && (
        <span className="flex items-center gap-1">
          <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
          <span className="font-medium text-amber-700">{speculative}</span> Speculative
        </span>
      )}
    </div>
  );
}

function BuyerCard({ buyer }: { buyer: BuyerScore }) {
  const tier = TIER_CONFIG[buyer.tier];
  const TierIcon = tier.icon;

  return (
    <div className="border rounded-lg p-4 space-y-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <h4 className="font-medium text-sm truncate">{buyer.company_name}</h4>
          </div>
          {buyer.pe_firm_name && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-6 truncate">
              {buyer.pe_firm_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={cn('text-xs', tier.color)}>
            <TierIcon className="h-3 w-3 mr-1" />
            {tier.label}
          </Badge>
          <Badge variant="secondary" className="text-xs font-mono">
            {buyer.composite_score}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {buyer.buyer_type && (
          <span className="capitalize">{buyer.buyer_type.replace('_', ' ')}</span>
        )}
        {buyer.hq_state && (
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {buyer.hq_city ? `${buyer.hq_city}, ${buyer.hq_state}` : buyer.hq_state}
          </span>
        )}
        {buyer.has_fee_agreement && (
          <span className="flex items-center gap-0.5 text-green-600">
            <FileCheck className="h-3 w-3" />
            Fee Agreement
          </span>
        )}
      </div>

      {buyer.fit_signals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {buyer.fit_signals.slice(0, 4).map((signal, i) => (
            <Badge key={i} variant="outline" className="text-[10px] font-normal">
              {signal}
            </Badge>
          ))}
          {buyer.fit_signals.length > 4 && (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              +{buyer.fit_signals.length - 4} more
            </Badge>
          )}
        </div>
      )}

      {/* Sub-scores breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Service', value: buyer.service_score, color: 'bg-violet-500' },
          { label: 'Geography', value: buyer.geography_score, color: 'bg-sky-500' },
          { label: 'Size', value: buyer.size_score, color: 'bg-teal-500' },
          { label: 'Bonus', value: buyer.bonus_score, color: 'bg-amber-500' },
        ].map((sub) => (
          <div key={sub.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{sub.label}</span>
              <span className="text-[10px] font-mono font-medium">{sub.value}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', sub.color)}
                style={{ width: `${sub.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  inserted: { label: 'New', color: 'bg-green-100 text-green-800', icon: Plus },
  enriched_existing: { label: 'Updated', color: 'bg-blue-100 text-blue-800', icon: Check },
  probable_duplicate: { label: 'Duplicate', color: 'bg-gray-100 text-gray-600', icon: Copy },
  cached: { label: 'Cached', color: 'bg-purple-100 text-purple-800', icon: Check },
};

function SeedResultsSummary({ results }: { results: SeedBuyerResult[] }) {
  const inserted = results.filter(r => r.action === 'inserted').length;
  const enriched = results.filter(r => r.action === 'enriched_existing').length;
  const dupes = results.filter(r => r.action === 'probable_duplicate').length;

  return (
    <div className="border rounded-lg bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-purple-600" />
        AI Seeding Results
      </div>
      <div className="flex items-center gap-3 text-xs">
        {inserted > 0 && (
          <span className="text-green-700">{inserted} new buyers added</span>
        )}
        {enriched > 0 && (
          <span className="text-blue-700">{enriched} existing updated</span>
        )}
        {dupes > 0 && (
          <span className="text-gray-500">{dupes} duplicates skipped</span>
        )}
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {results.slice(0, 10).map((result) => {
          const config = ACTION_CONFIG[result.action] || ACTION_CONFIG.inserted;
          const Icon = config.icon;
          return (
            <div key={result.buyer_id} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className={cn('text-[10px] shrink-0', config.color)}>
                <Icon className="h-2.5 w-2.5 mr-0.5" />
                {config.label}
              </Badge>
              <span className="truncate font-medium">{result.company_name}</span>
            </div>
          );
        })}
        {results.length > 10 && (
          <p className="text-[10px] text-muted-foreground">+{results.length - 10} more</p>
        )}
      </div>
    </div>
  );
}

export function RecommendedBuyersPanel({ listingId }: RecommendedBuyersPanelProps) {
  const { data, isLoading, isError, error, refresh } = useNewRecommendedBuyers(listingId);
  const seedMutation = useSeedBuyers();
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [seedResults, setSeedResults] = useState<SeedBuyerResult[] | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      toast.success('Recommendations refreshed');
    } catch (err) {
      toast.error('Failed to refresh recommendations');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSeedBuyers = async () => {
    setSeedResults(null);
    try {
      const result = await seedMutation.mutateAsync({ listingId, forceRefresh: false });
      setSeedResults(result.seeded_buyers);
      if (result.cached) {
        toast.info(`Found ${result.total} cached AI-seeded buyers`);
      } else {
        toast.success(
          `AI seeded ${result.total} buyers: ${result.inserted || 0} new, ${result.enriched_existing || 0} updated`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to seed buyers');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Recommended Buyers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to load recommendations';
    const isAuthError = errorMsg.toLowerCase().includes('unauthorized') || errorMsg.toLowerCase().includes('forbidden');
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Recommended Buyers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm font-medium text-destructive">
              {isAuthError ? 'Access Denied' : 'Scoring Failed'}
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              {errorMsg}
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const buyers = data?.buyers || [];
  const totalPages = Math.ceil(buyers.length / PAGE_SIZE);
  const paginatedBuyers = buyers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Recommended Buyers
            {data?.total ? (
              <Badge variant="secondary" className="text-xs ml-1">
                {data.total}
              </Badge>
            ) : null}
          </CardTitle>
          {buyers.length > 0 && <TierSummary buyers={buyers} />}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedBuyers}
            disabled={seedMutation.isPending}
          >
            <Sparkles className={cn('h-3.5 w-3.5 mr-1.5', seedMutation.isPending && 'animate-pulse')} />
            {seedMutation.isPending ? 'Seeding...' : 'AI Seed'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {seedResults && seedResults.length > 0 && (
          <div className="mb-4">
            <SeedResultsSummary results={seedResults} />
          </div>
        )}
        {buyers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No buyer recommendations yet. Click Refresh to score buyers.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedBuyers.map(buyer => (
              <BuyerCard key={buyer.buyer_id} buyer={buyer} />
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, buyers.length)} of {buyers.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs px-2">{page + 1} / {totalPages}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {data?.cached && (
              <p className="text-[10px] text-muted-foreground text-right">
                Cached results from {new Date(data.scored_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
