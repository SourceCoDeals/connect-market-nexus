/**
 * Portal deal recommendation scoring — web-side entry point.
 *
 * Re-exports the pure scoring functions from the edge function source so
 * both the Deno-side cron worker and the React admin UI use the same
 * implementation. Changing `../../../supabase/functions/.../scoring.ts`
 * automatically updates both call sites and the vitest suite.
 *
 * The target file has no Deno-specific imports (no Deno.*, no esm.sh,
 * no https:// imports) — it is plain TypeScript and can be bundled by
 * Vite without any config changes.
 */
export {
  scoreListingAgainstCriteria,
  keywordMatches,
  reasonsEqual,
  escapeRegex,
  type ThesisCriteria,
  type ScoreResult,
} from '../../../supabase/functions/process-portal-recommendations/scoring';
