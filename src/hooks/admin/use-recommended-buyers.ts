// Barrel file — re-exports everything that was originally in this module.
// The actual implementations have been split into focused files:
//   use-recommended-buyers-types.ts   — TranscriptInsight, OutreachInfo, RecommendedBuyer, RecommendedBuyersResult
//   use-recommended-buyers-scoring.ts — classifyTier, computeFitSignals, EMPTY_TRANSCRIPT, EMPTY_OUTREACH
//   use-recommended-buyers-sources.ts — fetchMarketplaceBuyers, fetchPipelineBuyers, fetchContactBuyers
//   use-recommended-buyers-query.ts   — useRecommendedBuyers

export type {
  TranscriptInsight,
  OutreachInfo,
  RecommendedBuyer,
  RecommendedBuyersResult,
} from './use-recommended-buyers-types';

export { useRecommendedBuyers } from './use-recommended-buyers-query';
