/**
 * useDailyTasks — barrel re-export
 *
 * Query hooks live in ./useDailyTaskQueries.ts
 * Mutation hooks live in ./useDailyTaskMutations.ts
 *
 * This file re-exports everything for backward compatibility.
 */

// ─── Query hooks ───

export { useDailyTasks, DAILY_TASKS_QUERY_KEY } from './useDailyTaskQueries';

// ─── Mutation hooks ───

export {
  recomputeRanks,
  useToggleTaskComplete,
  useApproveTask,
  useApproveAllTasks,
  useReassignTask,
  useEditTask,
  useAddManualTask,
  useDeleteTask,
  usePinTask,
  useTriggerExtraction,
} from './useDailyTaskMutations';
