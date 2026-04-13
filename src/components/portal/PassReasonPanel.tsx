import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePortalPassReasons } from '@/hooks/portal/use-portal-pass-reasons';
import { PASS_REASON_LABELS, type PassReasonCategory } from '@/types/portal';

interface PassReasonPanelProps {
  portalOrgId: string;
}

// When a reason dominates, surface an admin-facing hint about which
// thesis dial to adjust. Conservative — only shows for clear patterns.
const HINTS: Partial<Record<PassReasonCategory, string>> = {
  too_small: "Consider raising EBITDA min on this portal's thesis.",
  too_large: "Consider lowering EBITDA max on this portal's thesis.",
  wrong_geography: 'Consider narrowing or widening target states.',
  wrong_industry: 'Review industry keywords — they may be matching too broadly.',
  owner_dependency: 'Flag deals where owner hand-off risk is evident before pushing.',
  already_in_discussions: 'Check for duplicate pushes or run dedup against their active pipeline.',
  not_cultural_fit: 'Discuss culture fit criteria with the client directly.',
  timing_not_right: 'No action — timing is outside our control.',
};

export function PassReasonPanel({ portalOrgId }: PassReasonPanelProps) {
  const { data: reasons, isLoading } = usePortalPassReasons(portalOrgId);

  const total = reasons?.reduce((sum, r) => sum + r.pass_count, 0) ?? 0;

  // Identify dominant reason (>= 40% of passes) to surface the hint.
  const dominant =
    reasons && total > 0 ? reasons.find((r) => r.pass_count / total >= 0.4) : undefined;
  const dominantHint = dominant ? HINTS[dominant.pass_reason_category] : undefined;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4" />
          Pass Reason Breakdown
          {total > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {total} total
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {!isLoading && (!reasons || reasons.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No clients have passed on a deal with a stated reason yet. Reasons appear here once
            clients hit Pass and pick a category.
          </p>
        )}

        {!isLoading && reasons && reasons.length > 0 && (
          <>
            <div className="space-y-1.5">
              {reasons.map((row) => {
                const pct = total > 0 ? Math.round((row.pass_count / total) * 100) : 0;
                return (
                  <div key={row.pass_reason_category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {PASS_REASON_LABELS[row.pass_reason_category] ?? row.pass_reason_category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.pass_count} ({pct}%) ·{' '}
                        {formatDistanceToNow(new Date(row.most_recent_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="h-1.5 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {dominantHint && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">Suggested action:</span> {dominantHint}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
