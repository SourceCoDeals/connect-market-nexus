/**
 * Tests for the auto-task lifecycle decision logic (Fix #4).
 *
 * The pure function `decideTaskLifecycle` is the rule core: given an
 * incoming call outcome and a list of currently-open follow_up_with_buyer
 * tasks for the same (deal_id, contact-key) scope, it returns one of:
 *   - none
 *   - create
 *   - update_existing  (voicemail/no_answer dedup)
 *   - supersede_and_create  (callback supersedes existing follow-ups)
 *   - supersede_only  (connected closes any pending follow-ups)
 */
import { describe, it, expect } from 'vitest';
import { decideTaskLifecycle, type OpenFollowUpTask } from './auto-task-lifecycle';

const baseTask: OpenFollowUpTask = {
  id: 't-1',
  task_type: 'follow_up_with_buyer',
  status: 'pending',
  due_date: '2026-04-30',
  metadata: null,
};

describe('decideTaskLifecycle — voicemail / no_answer dedup', () => {
  it('creates a new follow-up task when no open ones exist', () => {
    const d = decideTaskLifecycle('voicemail', []);
    expect(d).toEqual({
      action: 'create',
      task_type: 'follow_up_with_buyer',
      due_offset_days: 3,
      priority: 'medium',
    });
  });

  it('updates the existing follow-up task on a repeat voicemail', () => {
    const d = decideTaskLifecycle('voicemail', [baseTask]);
    expect(d).toEqual({
      action: 'update_existing',
      task_id: 't-1',
      new_due_offset_days: 3,
      new_voicemail_count: 1,
    });
  });

  it('increments voicemail_count from existing metadata', () => {
    const d = decideTaskLifecycle('voicemail', [{ ...baseTask, metadata: { voicemail_count: 4 } }]);
    expect(d).toMatchObject({
      action: 'update_existing',
      task_id: 't-1',
      new_voicemail_count: 5,
    });
  });

  it('handles non-numeric voicemail_count gracefully', () => {
    const d = decideTaskLifecycle('voicemail', [
      { ...baseTask, metadata: { voicemail_count: 'oops' as unknown as number } },
    ]);
    expect(d).toMatchObject({
      action: 'update_existing',
      new_voicemail_count: 1,
    });
  });

  it('no_answer behaves identically to voicemail', () => {
    const created = decideTaskLifecycle('no_answer', []);
    expect(created).toMatchObject({ action: 'create', task_type: 'follow_up_with_buyer' });

    const updated = decideTaskLifecycle('no_answer', [baseTask]);
    expect(updated).toMatchObject({ action: 'update_existing', task_id: 't-1' });
  });

  it('does not dedupe against schedule_call tasks (different task_type)', () => {
    const d = decideTaskLifecycle('voicemail', [
      { ...baseTask, id: 't-sc', task_type: 'schedule_call' },
    ]);
    expect(d).toEqual({
      action: 'create',
      task_type: 'follow_up_with_buyer',
      due_offset_days: 3,
      priority: 'medium',
    });
  });

  it('picks the FIRST follow-up task when multiple exist (first-found rather than create-another)', () => {
    const tasks: OpenFollowUpTask[] = [
      { ...baseTask, id: 't-a', metadata: { voicemail_count: 2 } },
      { ...baseTask, id: 't-b', metadata: { voicemail_count: 5 } },
    ];
    const d = decideTaskLifecycle('voicemail', tasks);
    expect(d).toMatchObject({ action: 'update_existing', task_id: 't-a' });
  });
});

describe('decideTaskLifecycle — callback supersedes', () => {
  it('creates a schedule_call task when no open follow-ups exist', () => {
    const d = decideTaskLifecycle('callback', []);
    expect(d).toEqual({
      action: 'create',
      task_type: 'schedule_call',
      due_offset_days: 1,
      priority: 'high',
    });
  });

  it('supersedes open follow-ups AND creates a schedule_call', () => {
    const tasks: OpenFollowUpTask[] = [
      { ...baseTask, id: 't-1' },
      { ...baseTask, id: 't-2' },
    ];
    const d = decideTaskLifecycle('callback', tasks);
    expect(d).toEqual({
      action: 'supersede_and_create',
      supersede_task_ids: ['t-1', 't-2'],
      task_type: 'schedule_call',
      due_offset_days: 1,
      priority: 'high',
      supersede_reason: 'callback_scheduled_supersedes_followups',
    });
  });

  it('does not supersede schedule_call tasks (only follow_up_with_buyer)', () => {
    const tasks: OpenFollowUpTask[] = [
      { ...baseTask, id: 't-fu', task_type: 'follow_up_with_buyer' },
      { ...baseTask, id: 't-sc', task_type: 'schedule_call' },
    ];
    const d = decideTaskLifecycle('callback', tasks);
    expect(d).toMatchObject({
      action: 'supersede_and_create',
      supersede_task_ids: ['t-fu'],
    });
  });
});

describe('decideTaskLifecycle — connected supersedes only', () => {
  it('returns none when no open follow-ups', () => {
    expect(decideTaskLifecycle('connected', [])).toEqual({ action: 'none' });
  });

  it('supersedes open follow-ups without creating a new task', () => {
    const tasks: OpenFollowUpTask[] = [
      { ...baseTask, id: 't-1' },
      { ...baseTask, id: 't-2' },
    ];
    const d = decideTaskLifecycle('connected', tasks);
    expect(d).toEqual({
      action: 'supersede_only',
      supersede_task_ids: ['t-1', 't-2'],
      supersede_reason: 'connected_during_subsequent_call',
    });
  });
});

describe('decideTaskLifecycle — no auto-task outcomes', () => {
  it('busy outcome creates nothing, supersedes nothing', () => {
    expect(decideTaskLifecycle('busy', [baseTask])).toEqual({ action: 'none' });
  });

  it('wrong_number outcome creates nothing, supersedes nothing', () => {
    expect(decideTaskLifecycle('wrong_number', [baseTask])).toEqual({ action: 'none' });
  });
});
