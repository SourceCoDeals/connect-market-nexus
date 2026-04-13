import { useMemo, useCallback } from 'react';
import { useBuyerIntroductions } from '@/hooks/use-buyer-introductions';
import { untypedFrom, supabase } from '@/integrations/supabase/client';
import type {
  BuyerIntroduction,
  IntroductionStatus,
  ScoreSnapshot,
  UpdateBuyerIntroductionInput,
} from '@/types/buyer-introductions';

export type KanbanColumn = 'to_introduce' | 'introduced' | 'interested' | 'passed';

const COLUMN_STATUSES: Record<KanbanColumn, IntroductionStatus[]> = {
  to_introduce: ['need_to_show_deal'],
  introduced: ['outreach_initiated'],
  interested: ['meeting_scheduled', 'fit_and_interested', 'deal_created'],
  passed: ['not_a_fit'],
};

const STATUS_FOR_COLUMN: Record<KanbanColumn, IntroductionStatus> = {
  to_introduce: 'need_to_show_deal',
  introduced: 'outreach_initiated',
  interested: 'meeting_scheduled',
  passed: 'not_a_fit',
};

export function getColumnForStatus(status: IntroductionStatus): KanbanColumn {
  for (const [column, statuses] of Object.entries(COLUMN_STATUSES)) {
    if (statuses.includes(status)) return column as KanbanColumn;
  }
  return 'to_introduce';
}

export function getStatusForColumn(column: KanbanColumn): IntroductionStatus {
  return STATUS_FOR_COLUMN[column];
}

/**
 * Write a buyer_discovery_feedback row when a buyer is rejected via the Kanban.
 * This feeds the -15 niche rejection penalty in score-deal-buyers and the hard
 * exclusion on this same deal's future refreshes. Without this, moving a card
 * to "Not a Fit" only set passed_date and never affected future scoring.
 */
async function recordKanbanRejectionFeedback(
  listingId: string,
  intro: BuyerIntroduction,
  passedReason: string | undefined,
) {
  if (!intro.remarketing_buyer_id) return;

  try {
    // Fetch the deal's niche context. Cached at the request layer by Supabase;
    // these moves are human-scale (not hot-path) so an extra read is fine.
    const { data: listing } = await supabase
      .from('listings')
      .select('industry, category, categories')
      .eq('id', listingId)
      .maybeSingle();

    const industry = (listing as { industry: string | null } | null)?.industry || null;
    const categories = (listing as { categories: string[] | null } | null)?.categories || null;
    const primaryCategory = (listing as { category: string | null } | null)?.category || null;
    const nicheCategory = industry || categories?.[0] || primaryCategory || 'general';
    const snap = intro.score_snapshot;

    await untypedFrom('buyer_discovery_feedback').upsert(
      {
        listing_id: listingId,
        buyer_id: intro.remarketing_buyer_id,
        buyer_name: intro.buyer_name || intro.company_name,
        pe_firm_name: snap?.pe_firm_name || null,
        action: 'rejected',
        reason: passedReason || null,
        reason_category: null,
        niche_category: nicheCategory,
        deal_industry: industry,
        deal_categories: categories,
        buyer_type: snap?.buyer_type || null,
        buyer_source: snap?.source || null,
        composite_score: snap?.composite_score ?? null,
        service_score: snap?.service_score ?? null,
      },
      { onConflict: 'listing_id,buyer_id,action' },
    );
  } catch (err) {
    // Non-fatal — logging only so that future scoring doesn't silently lose the signal.
    console.error('Failed to record Kanban rejection feedback (non-fatal):', err);
  }
}

export function useIntroductionPipeline(listingId: string | undefined) {
  const hook = useBuyerIntroductions(listingId);
  const { introductions, updateStatus } = hook;

  const columns = useMemo(() => {
    const result: Record<KanbanColumn, BuyerIntroduction[]> = {
      to_introduce: [],
      introduced: [],
      interested: [],
      passed: [],
    };

    for (const intro of introductions) {
      const col = getColumnForStatus(intro.introduction_status);
      result[col].push(intro);
    }

    // Sort each column
    result.to_introduce.sort((a, b) => {
      const aSnap = a.score_snapshot as ScoreSnapshot | null;
      const bSnap = b.score_snapshot as ScoreSnapshot | null;
      return (bSnap?.composite_score ?? 0) - (aSnap?.composite_score ?? 0); // highest score first
    });

    result.introduced.sort((a, b) => {
      const aDate = a.introduction_date ? new Date(a.introduction_date).getTime() : Infinity;
      const bDate = b.introduction_date ? new Date(b.introduction_date).getTime() : Infinity;
      return aDate - bDate; // oldest first (longest-waiting at top)
    });

    result.interested.sort((a, b) => {
      const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bDate - aDate; // newest first
    });

    result.passed.sort((a, b) => {
      const aDate = a.passed_date ? new Date(a.passed_date).getTime() : 0;
      const bDate = b.passed_date ? new Date(b.passed_date).getTime() : 0;
      return bDate - aDate; // newest first
    });

    return result;
  }, [introductions]);

  const moveToColumn = useCallback(
    (
      introId: string,
      targetColumn: KanbanColumn,
      extra?: {
        introduction_method?: string;
        introduction_notes?: string;
        passed_reason?: string;
        passed_notes?: string;
        buyer_feedback?: string;
        next_step?: string;
        expected_next_step_date?: string;
      },
    ) => {
      const newStatus = getStatusForColumn(targetColumn);
      const updates: UpdateBuyerIntroductionInput = {
        introduction_status: newStatus,
        ...extra,
      };

      if (targetColumn === 'introduced') {
        updates.introduction_date = new Date().toISOString();
      }
      if (targetColumn === 'passed') {
        updates.passed_date = new Date().toISOString().split('T')[0];
      }

      updateStatus({ id: introId, updates });

      // Feedback loop: when a buyer is moved to "Not a Fit" on the Kanban,
      // write a buyer_discovery_feedback row so the scoring engine can apply
      // the niche rejection penalty and hard-exclusion on future refreshes.
      // Fire-and-forget — errors are logged inside recordKanbanRejectionFeedback.
      if (targetColumn === 'passed' && listingId) {
        const intro = introductions.find((i) => i.id === introId);
        if (intro) {
          void recordKanbanRejectionFeedback(listingId, intro, extra?.passed_reason);
        }
      }
    },
    [updateStatus, listingId, introductions],
  );

  /** Update only the notes on an introduction — does NOT change status */
  const updateIntroductionNotes = useCallback(
    (introId: string, notes: string) => {
      updateStatus({
        id: introId,
        updates: { introduction_notes: notes },
      });
    },
    [updateStatus],
  );

  const introductionIds = useMemo(() => {
    return new Set(introductions.map((i) => i.remarketing_buyer_id).filter(Boolean) as string[]);
  }, [introductions]);

  return {
    ...hook,
    columns,
    moveToColumn,
    updateIntroductionNotes,
    introductionIds,
  };
}
