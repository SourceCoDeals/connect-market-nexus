// Barrel file — re-exports everything that was originally in this module.
// The actual implementations have been split into focused files:
//   deal-types.ts            — Deal, DealStage interfaces
//   use-deal-queries.ts      — useDeals, useDealStages, useStageDealCount
//   use-deal-mutations.ts    — useUpdateDealStage, useUpdateDeal, useCreateDeal, useSoftDeleteDeal, useRestoreDeal
//   use-deal-stage-mutations.ts — useCreateDealStage, useUpdateDealStageData, useDeleteDealStage

export type { Deal, DealStage } from './deal-types';
export { useDeals, useDealStages, useStageDealCount } from './use-deal-queries';
export {
  useUpdateDealStage,
  useUpdateDeal,
  useCreateDeal,
  useSoftDeleteDeal,
  useRestoreDeal,
} from './use-deal-mutations';
export {
  useCreateDealStage,
  useUpdateDealStageData,
  useDeleteDealStage,
} from './use-deal-stage-mutations';
