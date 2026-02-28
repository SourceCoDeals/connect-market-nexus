/**
 * Auto-populate Top 5 on Deal Import
 *
 * When a new deal listing is created and has a listing_id assigned,
 * triggers a background scoring job so that the Top 5 panel is
 * pre-populated without any manual action.
 *
 * This connects deal creation to the existing scoring queue infrastructure
 * via the process-scoring-queue edge function.
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Triggers automatic buyer scoring for a listing.
 * This is a fire-and-forget operation — the scoring runs in the background.
 *
 * Steps:
 * 1. Find the universe associated with this listing (if any)
 * 2. Check if scoring has already been run for this listing
 * 3. If not scored yet, trigger the scoring queue
 */
export async function triggerAutoScoring(listingId: string): Promise<void> {
  if (!listingId) return;

  // Check if this listing already has scores
  const { data: existingScores, error: checkError } = await supabase
    .from('remarketing_scores')
    .select('id')
    .eq('listing_id', listingId)
    .limit(1);

  if (checkError) {
    console.warn('[autoScoreOnDealCreate] Error checking existing scores:', checkError);
    return;
  }

  // If scores already exist, no need to auto-trigger
  if (existingScores && existingScores.length > 0) {
    return;
  }

  // Find the universe for this listing (listings can be part of a remarketing universe)
  const { data: universeLinks, error: ulError } = await supabase
    .from('remarketing_scoring_queue')
    .select('universe_id')
    .eq('listing_id', listingId)
    .limit(1);

  // Try to find a universe from the deal's listing direct association
  let universeId: string | null = null;

  if (!ulError && universeLinks && universeLinks.length > 0) {
    universeId = universeLinks[0].universe_id;
  } else {
    // Look for any active universe that might contain this listing
    const { data: universes } = await supabase
      .from('remarketing_buyer_universes')
      .select('id')
      .eq('archived', false)
      .limit(1);

    if (universes && universes.length > 0) {
      universeId = universes[0].id;
    }
  }

  if (!universeId) {
    console.info('[autoScoreOnDealCreate] No universe found for listing — skipping auto-score');
    return;
  }

  // Trigger scoring via the edge function (fire-and-forget)
  supabase.functions
    .invoke('process-scoring-queue', {
      body: {
        trigger: 'deal-scoring',
        listing_id: listingId,
        universe_id: universeId,
        auto_triggered: true,
      },
    })
    .then(() => {
      console.info('[autoScoreOnDealCreate] Auto-scoring triggered for listing:', listingId);
    })
    .catch((err) => {
      console.warn('[autoScoreOnDealCreate] Worker trigger failed:', err);
    });
}
