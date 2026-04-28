// ============================================================================
// auto-task-lifecycle
// ============================================================================
// Pure decision logic for the auto-task chain in LogManualTouchDialog.
// Audit finding UC #12: repeated voicemail outcomes spawn N parallel tasks;
// callback/connected outcomes don't supersede prior follow-up tasks.
//
// Inputs: the new call outcome + the set of currently-open follow_up_with_buyer
// tasks for the same (deal_id, contact-key).
//
// Outputs: a decision describing what to write — either CREATE a new task,
// UPDATE an existing one (dedup), or SUPERSEDE existing ones and CREATE.
//
// Kept as a pure function so behavior is testable without a DB.
// ============================================================================

export type CallOutcome =
  | 'connected'
  | 'voicemail'
  | 'no_answer'
  | 'callback'
  | 'busy'
  | 'wrong_number';

export interface OpenFollowUpTask {
  id: string;
  task_type: string;
  status: string;
  due_date: string | null;
  /** ISO timestamp from metadata; tracks how many voicemails this task absorbed. */
  metadata?: Record<string, unknown> | null;
}

export type LifecycleDecision =
  | { action: 'none' }
  | {
      action: 'create';
      task_type: 'follow_up_with_buyer' | 'schedule_call';
      due_offset_days: 1 | 3;
      priority: 'high' | 'medium';
    }
  | {
      action: 'update_existing';
      task_id: string;
      new_due_offset_days: 3;
      new_voicemail_count: number;
    }
  | {
      action: 'supersede_and_create';
      supersede_task_ids: string[];
      task_type: 'schedule_call';
      due_offset_days: 1;
      priority: 'high';
      supersede_reason: string;
    }
  | {
      action: 'supersede_only';
      supersede_task_ids: string[];
      supersede_reason: string;
    };

/**
 * Decide what auto-task action to take given a new call outcome and the set
 * of currently-open follow-up-with-buyer tasks for the same (deal_id,
 * contact-key) scope. The caller is responsible for filtering openTasks
 * down to just the relevant deal+contact before passing in.
 */
export function decideTaskLifecycle(
  outcome: CallOutcome,
  openFollowUpTasks: OpenFollowUpTask[],
): LifecycleDecision {
  // Voicemail / no-answer: dedup into existing follow-up task if one exists.
  if (outcome === 'voicemail' || outcome === 'no_answer') {
    const existingFollowUp = openFollowUpTasks.find((t) => t.task_type === 'follow_up_with_buyer');
    if (existingFollowUp) {
      const prevCount = Number(
        (existingFollowUp.metadata as Record<string, unknown> | null | undefined)
          ?.voicemail_count ?? 0,
      );
      return {
        action: 'update_existing',
        task_id: existingFollowUp.id,
        new_due_offset_days: 3,
        new_voicemail_count: Number.isFinite(prevCount) ? prevCount + 1 : 1,
      };
    }
    return {
      action: 'create',
      task_type: 'follow_up_with_buyer',
      due_offset_days: 3,
      priority: 'medium',
    };
  }

  // Callback scheduled: create a new schedule_call task AND supersede any
  // existing follow-up tasks (the callback subsumes them).
  if (outcome === 'callback') {
    const supersedeIds = openFollowUpTasks
      .filter((t) => t.task_type === 'follow_up_with_buyer')
      .map((t) => t.id);
    if (supersedeIds.length > 0) {
      return {
        action: 'supersede_and_create',
        supersede_task_ids: supersedeIds,
        task_type: 'schedule_call',
        due_offset_days: 1,
        priority: 'high',
        supersede_reason: 'callback_scheduled_supersedes_followups',
      };
    }
    return {
      action: 'create',
      task_type: 'schedule_call',
      due_offset_days: 1,
      priority: 'high',
    };
  }

  // Connected: supersede any open follow-ups since we actually reached them.
  // Don't create a new task — the user can decide what to do next.
  if (outcome === 'connected') {
    const supersedeIds = openFollowUpTasks
      .filter((t) => t.task_type === 'follow_up_with_buyer')
      .map((t) => t.id);
    if (supersedeIds.length > 0) {
      return {
        action: 'supersede_only',
        supersede_task_ids: supersedeIds,
        supersede_reason: 'connected_during_subsequent_call',
      };
    }
    return { action: 'none' };
  }

  // busy / wrong_number / anything else: no auto-task.
  return { action: 'none' };
}
