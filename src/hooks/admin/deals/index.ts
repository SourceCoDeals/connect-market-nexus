export type { Deal, DealStage } from './types';
export { useDeals } from './useDealsList';
export { useDealStages, useStageDealCount } from './useDealStages';
export {
  useUpdateDealStage,
  useUpdateDeal,
  useCreateDeal,
  useSoftDeleteDeal,
  useRestoreDeal,
} from './useDealMutations';
export {
  useCreateDealStage,
  useUpdateDealStageData,
  useDeleteDealStage,
} from './useStageMutations';
