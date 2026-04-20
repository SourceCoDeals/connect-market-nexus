/**
 * usePipelineMetrics.ts
 *
 * Data hook for the Pipeline & Velocity tab. Uses direct Supabase queries
 * (deal_pipeline + deal_stages + listings) rather than a new RPC so we can ship
 * phase 3 without another migration. If this becomes slow for large pipelines,
 * promote the aggregation into an RPC.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getFromDate, type Timeframe } from '../useDashboardData';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DealStage {
  id: string;
  name: string;
  position: number;
  color: string | null;
}

interface PipelineDeal {
  id: string;
  stage_id: string | null;
  listing_id: string | null;
  assigned_to: string | null;
  stage_entered_at: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  nda_status: string | null;
  fee_agreement_status: string | null;
  listings: {
    ebitda: number | null;
    revenue: number | null;
    title: string | null;
    internal_company_name: string | null;
    deal_source: string | null;
  } | null;
}

export interface StageRow {
  stageId: string;
  stageName: string;
  position: number;
  color: string;
  dealCount: number;
  totalEbitda: number;
}

export interface AtRiskDeal {
  id: string;
  companyName: string;
  stageName: string;
  stageColor: string;
  daysInStage: number;
  ebitda: number | null;
  assignedTo: string | null;
}

export interface ClosedWonDeal {
  id: string;
  companyName: string;
  ebitda: number | null;
  source: string | null;
  daysToClose: number;
  closedAt: string;
}

export interface PipelineKPIs {
  /** Current snapshot — total EBITDA in all active pipeline stages right now. */
  totalPipelineEbitda: number;
  /** Current snapshot — count of deals in all active pipeline stages right now. */
  totalPipelineDeals: number;
  /**
   * Historical — average days from deal created to Closed Won move.
   * Null when there are no closed deals, so the UI can display "—" instead
   * of a misleading "0d".
   */
  avgDaysToClose: number | null;
  /** Period-scoped — NDA signed → Fee agreement signed conversion rate (%). */
  ndaToFeeRate: number;
  /** Current snapshot — deals with no stage move in >30 days. */
  stalledCount: number;
  /**
   * **In period** — deal_pipeline rows created in the selected timeframe.
   * NOTE: pipeline rows are auto-created from listings via a trigger, so
   * this reflects "new deals added to the platform" more than "pushed into
   * the sales pipeline". The KPI label has been renamed accordingly.
   */
  newInPeriod: number;
  /** **In period** — deals that moved to Closed Won in the selected timeframe. */
  closedWonInPeriod: number;
}

export interface NdaFeeCounts {
  /** Current snapshot totals. */
  ndaSent: number;
  ndaSigned: number;
  feeSent: number;
  feeSigned: number;
  /**
   * In-period activity totals: approximated by counting deals whose nda/fee
   * status is sent/signed AND whose updated_at falls inside the timeframe.
   * A deal whose nda_status was set weeks ago but got any update in the
   * period will be counted — the trigger bumps updated_at on every change,
   * so this is a reasonable activity proxy.
   */
  ndaSentInPeriod: number;
  ndaSignedInPeriod: number;
  feeSentInPeriod: number;
  feeSignedInPeriod: number;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

const STALL_DAYS = 30;

export function usePipelineMetrics(timeframe: Timeframe) {
  const fromDate = getFromDate(timeframe);

  const {
    data: stages,
    isLoading: stagesLoading,
    error: stagesError,
    refetch: refetchStages,
  } = useQuery({
    queryKey: ['pipeline', 'stages'],
    queryFn: async (): Promise<DealStage[]> => {
      const { data, error } = await (supabase as any)
        .from('deal_stages')
        .select('id, name, position, color')
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      return (data || []) as DealStage[];
    },
    staleTime: 5 * 60_000,
  });

  const {
    data: deals,
    isLoading: dealsLoading,
    error: dealsError,
    refetch: refetchDeals,
  } = useQuery({
    queryKey: ['pipeline', 'deals'],
    queryFn: async (): Promise<PipelineDeal[]> => {
      const { data, error } = await (supabase as any)
        .from('deal_pipeline')
        .select(
          'id, stage_id, listing_id, assigned_to, stage_entered_at, created_at, updated_at, last_activity_at, nda_status, fee_agreement_status, listings(ebitda, revenue, title, internal_company_name, deal_source)',
        )
        .is('deleted_at', null)
        .limit(5000);
      if (error) throw error;
      return (data || []) as PipelineDeal[];
    },
    staleTime: 60_000,
  });

  const stageById = new Map((stages || []).map((s) => [s.id, s]));
  // Find terminal stages by name match. If the stage is ever renamed, the
  // hook degrades gracefully (KPIs just miss those rows) rather than
  // crashing — but add warnings here so the issue is visible in devtools.
  const closedWonStage = (stages || []).find((s) => s.name === 'Closed Won');
  const closedLostStage = (stages || []).find((s) => s.name === 'Closed Lost');
  if (stages && stages.length > 0 && !closedWonStage) {
    console.warn('[usePipelineMetrics] No stage named "Closed Won" found');
  }

  // ─── Stage counts ──────────────────────────────────────────────────────
  const stageRows: StageRow[] = (stages || [])
    .filter((s) => s.name !== 'Closed Lost') // funnel excludes lost
    .map((s) => {
      const dealsInStage = (deals || []).filter((d) => d.stage_id === s.id);
      const totalEbitda = dealsInStage.reduce((sum, d) => sum + (d.listings?.ebitda ?? 0), 0);
      return {
        stageId: s.id,
        stageName: s.name,
        position: s.position,
        color: s.color || '#94a3b8',
        dealCount: dealsInStage.length,
        totalEbitda,
      };
    });

  // ─── KPIs ──────────────────────────────────────────────────────────────
  const activePipelineDeals = (deals || []).filter(
    (d) => d.stage_id && d.stage_id !== closedWonStage?.id && d.stage_id !== closedLostStage?.id,
  );

  const totalPipelineEbitda = activePipelineDeals.reduce(
    (sum, d) => sum + (d.listings?.ebitda ?? 0),
    0,
  );

  // Numeric date comparisons — string-comparing TIMESTAMPTZ values can fail
  // when Postgres serialises without fractional seconds and the JS side
  // includes them (or vice versa). Always go through Date.getTime().
  const fromDateTs = fromDate ? new Date(fromDate).getTime() : null;
  const tsAtOrAfter = (iso: string | null) =>
    !fromDateTs || (iso != null && new Date(iso).getTime() >= fromDateTs);

  const closedWonDealsAll = (deals || []).filter((d) => d.stage_id === closedWonStage?.id);
  const closedWonDealsInPeriod = closedWonDealsAll.filter((d) => tsAtOrAfter(d.updated_at));
  const avgDaysToClose: number | null = (() => {
    if (closedWonDealsAll.length === 0) return null;
    const days = closedWonDealsAll.map((d) => {
      const start = new Date(d.created_at).getTime();
      const end = new Date(d.updated_at).getTime();
      return (end - start) / (1000 * 60 * 60 * 24);
    });
    return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  })();

  // NDA→Fee rate, now scoped to the selected period so the filter actually
  // affects this number. Uses updated_at as a proxy for "activity happened
  // on this record during the period" — the stage-log trigger bumps
  // updated_at on every status change.
  const ndaSignedInPeriod = (deals || []).filter(
    (d) => d.nda_status === 'signed' && tsAtOrAfter(d.updated_at),
  ).length;
  const feeSignedInPeriod = (deals || []).filter(
    (d) => d.fee_agreement_status === 'signed' && tsAtOrAfter(d.updated_at),
  ).length;
  const ndaToFeeRate =
    ndaSignedInPeriod > 0 ? Math.round((feeSignedInPeriod / ndaSignedInPeriod) * 1000) / 10 : 0;

  // Stalled: in any non-terminal stage, no stage move in >30 days
  const now = Date.now();
  const stalledDeals = activePipelineDeals.filter((d) => {
    if (!d.stage_entered_at) return false;
    const ageDays = (now - new Date(d.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > STALL_DAYS;
  });

  // ─── In-period metrics ─────────────────────────────────────────────────
  // Using deal.created_at for "new to pipeline". Pipeline rows are
  // auto-created from listings via trigger, so this is really "new deals
  // added to the platform" — see the KPI card label.
  const newInPeriod = (deals || []).filter((d) => tsAtOrAfter(d.created_at)).length;

  const closedWonInPeriod = closedWonDealsInPeriod.length;

  const kpis: PipelineKPIs = {
    totalPipelineEbitda,
    totalPipelineDeals: activePipelineDeals.length,
    avgDaysToClose,
    ndaToFeeRate,
    stalledCount: stalledDeals.length,
    newInPeriod,
    closedWonInPeriod,
  };

  // ─── At-risk table (stalled deals, sorted by EBITDA desc) ──────────────
  const atRisk: AtRiskDeal[] = stalledDeals
    .map((d) => {
      const stage = d.stage_id ? stageById.get(d.stage_id) : null;
      const daysInStage = d.stage_entered_at
        ? Math.round((now - new Date(d.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        id: d.id,
        companyName: d.listings?.internal_company_name || d.listings?.title || '—',
        stageName: stage?.name || '—',
        stageColor: stage?.color || '#94a3b8',
        daysInStage,
        ebitda: d.listings?.ebitda ?? null,
        assignedTo: d.assigned_to,
      };
    })
    .sort((a, b) => (b.ebitda ?? 0) - (a.ebitda ?? 0))
    .slice(0, 15);

  // ─── Closed won log ────────────────────────────────────────────────────
  const closedWonLog: ClosedWonDeal[] = closedWonDealsInPeriod
    .map((d) => {
      const start = new Date(d.created_at).getTime();
      const end = new Date(d.updated_at).getTime();
      return {
        id: d.id,
        companyName: d.listings?.internal_company_name || d.listings?.title || '—',
        ebitda: d.listings?.ebitda ?? null,
        source: d.listings?.deal_source ?? null,
        daysToClose: Math.round((end - start) / (1000 * 60 * 60 * 24)),
        closedAt: d.updated_at,
      };
    })
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
    .slice(0, 20);

  // ─── NDA / Fee counts ──────────────────────────────────────────────────
  const dealsWithNdaSent = (deals || []).filter((d) =>
    ['sent', 'signed'].includes(d.nda_status || ''),
  );
  const dealsWithNdaSigned = (deals || []).filter((d) => d.nda_status === 'signed');
  const dealsWithFeeSent = (deals || []).filter((d) =>
    ['sent', 'signed'].includes(d.fee_agreement_status || ''),
  );
  const dealsWithFeeSigned = (deals || []).filter((d) => d.fee_agreement_status === 'signed');

  const ndaFeeCounts: NdaFeeCounts = {
    ndaSent: dealsWithNdaSent.length,
    ndaSigned: dealsWithNdaSigned.length,
    feeSent: dealsWithFeeSent.length,
    feeSigned: dealsWithFeeSigned.length,
    ndaSentInPeriod: dealsWithNdaSent.filter((d) => tsAtOrAfter(d.updated_at)).length,
    ndaSignedInPeriod: dealsWithNdaSigned.filter((d) => tsAtOrAfter(d.updated_at)).length,
    feeSentInPeriod: dealsWithFeeSent.filter((d) => tsAtOrAfter(d.updated_at)).length,
    feeSignedInPeriod: dealsWithFeeSigned.filter((d) => tsAtOrAfter(d.updated_at)).length,
  };

  // Previously `loading: dealsLoading || !stages` — if the stages query
  // errored, `stages` stayed undefined forever and the tab was stuck on
  // skeleton loaders with no escape hatch. Now `loading` tracks isLoading
  // directly so an error transitions out of the loading state and the tab
  // can render an error banner instead.
  const error = (stagesError || dealsError) as Error | null | undefined;
  const retry = () => {
    refetchStages();
    refetchDeals();
  };

  return {
    loading: dealsLoading || stagesLoading,
    error: error || null,
    retry,
    kpis,
    stageRows,
    atRisk,
    closedWonLog,
    ndaFeeCounts,
  };
}
