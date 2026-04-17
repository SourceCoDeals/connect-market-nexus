import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, untypedFrom } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreListingAgainstCriteria, type ThesisCriteria } from '@/lib/portal/scoring';
import { AsyncCombobox } from '@/components/ui/async-combobox';
import { useListingSearch, useListingLabel } from '@/hooks/portal/use-listing-search';

interface WhyNotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Portal org whose theses we're scoring against. */
  portalOrgId: string;
  /** Optional: pre-select a listing (e.g. from a recommendation card). */
  defaultListingId?: string | null;
}

interface ListingRow {
  id: string;
  industry: string | null;
  category: string | null;
  categories: string[] | null;
  services: string[] | null;
  service_mix: string | null;
  executive_summary: string | null;
  address_state: string | null;
  ebitda: number | null;
  revenue: number | null;
  linkedin_employee_count: number | null;
  deal_total_score: number | null;
  title: string | null;
  internal_company_name: string | null;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-700 bg-green-50 border-green-200';
  if (score >= 45) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  if (score >= 30) return 'text-orange-700 bg-orange-50 border-orange-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

export function WhyNotDialog({
  open,
  onOpenChange,
  portalOrgId,
  defaultListingId,
}: WhyNotDialogProps) {
  const [listingId, setListingId] = useState<string | null>(defaultListingId ?? null);
  const [search, setSearch] = useState('');

  const { options: listingOptions, isLoading: listingLoading } = useListingSearch(search);
  const { data: selectedLabel } = useListingLabel(listingId);

  // Fetch the selected listing row
  const { data: listing, isLoading: fetchingListing } = useQuery({
    queryKey: ['why-not-listing', listingId],
    queryFn: async () => {
      if (!listingId) return null;
      const { data, error } = await supabase
        .from('listings')
        .select(
          'id, industry, category, categories, services, service_mix, executive_summary, address_state, ebitda, revenue, linkedin_employee_count, deal_total_score, title, internal_company_name',
        )
        .eq('id', listingId)
        .maybeSingle();
      if (error) throw error;
      return data as ListingRow | null;
    },
    enabled: !!listingId && open,
  });

  // Fetch all active thesis criteria for this portal
  const { data: criteria, isLoading: fetchingCriteria } = useQuery({
    queryKey: ['why-not-criteria', portalOrgId],
    queryFn: async (): Promise<ThesisCriteria[]> => {
      const { data, error } = await untypedFrom('portal_thesis_criteria')
        .select(
          'id, portal_org_id, industry_label, industry_keywords, ebitda_min, ebitda_max, revenue_min, revenue_max, employee_min, employee_max, target_states, portfolio_buyer_id, priority',
        )
        .eq('portal_org_id', portalOrgId)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as ThesisCriteria[];
    },
    enabled: open,
  });

  // Run the pure scoring function against every thesis
  const results = useMemo(() => {
    if (!listing || !criteria) return [];
    return criteria
      .map((c) => ({
        criterion: c,
        ...scoreListingAgainstCriteria(listing as unknown as Record<string, unknown>, c),
      }))
      .sort((a, b) => b.score - a.score);
  }, [listing, criteria]);

  const strongestMatch = results[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Why did this match (or not)?</DialogTitle>
          <DialogDescription>
            Score any deal against every active thesis criterion for this portal — including theses
            that didn't meet the recommendation threshold (score &lt; 30). Useful for debugging
            matching logic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Deal picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Deal</label>
            <AsyncCombobox
              value={listingId}
              onValueChange={(v) => setListingId(v)}
              options={listingOptions}
              onSearchChange={setSearch}
              isLoading={listingLoading}
              selectedLabel={selectedLabel}
              placeholder="Pick a deal..."
              searchPlaceholder="Search deals..."
            />
          </div>

          {!listingId && (
            <p className="text-sm text-muted-foreground italic">
              Select a deal above to see its score against each thesis.
            </p>
          )}

          {(fetchingListing || fetchingCriteria) && listingId && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {listingId &&
            !fetchingListing &&
            !fetchingCriteria &&
            (!criteria || criteria.length === 0) && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>This portal has no active thesis criteria — nothing to score against.</span>
              </div>
            )}

          {listingId && !fetchingListing && !fetchingCriteria && results.length > 0 && (
            <>
              {/* Summary */}
              <div className="text-xs text-muted-foreground">
                Strongest match:{' '}
                <span className="font-medium text-foreground">
                  {strongestMatch.criterion.industry_label}
                </span>{' '}
                — {strongestMatch.score} points
                {strongestMatch.score < 30 && ' (below the 30-point threshold, no rec created)'}
              </div>

              {/* Per-thesis scoring cards */}
              <div className="space-y-2">
                {results.map(({ criterion, score, reasons, category }) => (
                  <Card key={criterion.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {criterion.industry_label}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            Keywords: {criterion.industry_keywords.join(', ') || '—'}
                          </div>
                        </div>
                        <div
                          className={cn(
                            'shrink-0 rounded-md border px-2.5 py-1 text-center',
                            scoreColor(score),
                          )}
                        >
                          <div className="text-lg font-bold leading-tight">{score}</div>
                          <div className="text-[10px] uppercase tracking-wide">{category}</div>
                        </div>
                      </div>

                      {reasons.length > 0 ? (
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {reasons.map((r, i) => {
                            const isPrimary = r.startsWith('[primary]');
                            const isSecondary = r.startsWith('[secondary]');
                            const cleaned = r.replace(/^\[(primary|secondary)\]\s*/, '');
                            return (
                              <li key={i} className="flex items-center gap-1.5">
                                <span>•</span>
                                {isPrimary && (
                                  <Badge
                                    variant="outline"
                                    className="h-4 text-[9px] px-1 bg-green-50 text-green-700 border-green-200"
                                  >
                                    primary
                                  </Badge>
                                )}
                                {isSecondary && (
                                  <Badge
                                    variant="outline"
                                    className="h-4 text-[9px] px-1 bg-amber-50 text-amber-700 border-amber-200"
                                  >
                                    secondary
                                  </Badge>
                                )}
                                <span>{cleaned}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No industry keyword match — hard gate failed.
                        </p>
                      )}

                      {score < 30 && (
                        <Badge variant="outline" className="text-[10px]">
                          Below threshold — no recommendation created
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
