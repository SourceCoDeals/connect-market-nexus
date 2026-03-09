/**
 * Hook for fetching standup meetings with their associated tasks.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StandupMeeting, DailyStandupTaskWithRelations } from '@/types/daily-tasks';

export const STANDUP_MEETINGS_QUERY_KEY = 'standup-meetings-tracker';

export interface StandupMeetingWithTasks extends StandupMeeting {
  tasks: DailyStandupTaskWithRelations[];
  summary: string | null;
  key_points: string[] | null;
  attendees: string[];
}

export function useStandupMeetings(options?: { limit?: number }) {
  return useQuery({
    queryKey: [STANDUP_MEETINGS_QUERY_KEY, options],
    queryFn: async () => {
      // Fetch meetings ordered by date descending
      const { data: meetings, error: meetingsError } = await supabase
        .from('standup_meetings' as never)
        .select('*')
        .order('meeting_date', { ascending: false })
        .limit(options?.limit || 50);

      if (meetingsError) throw meetingsError;
      if (!meetings || meetings.length === 0) return [];

      const meetingIds = (meetings as StandupMeeting[]).map((m) => m.id);

      // Fetch all tasks linked to these meetings
      const { data: tasks, error: tasksError } = await supabase
        .from('daily_standup_tasks' as never)
        .select(
          `*,
          assignee:profiles!daily_standup_tasks_assignee_id_fkey(id, first_name, last_name, email)`,
        )
        .in('source_meeting_id', meetingIds)
        .order('priority_score', { ascending: false });

      if (tasksError) throw tasksError;

      // Group tasks by meeting
      const tasksByMeeting = new Map<string, DailyStandupTaskWithRelations[]>();
      for (const task of (tasks || []) as DailyStandupTaskWithRelations[]) {
        const meetingId = task.source_meeting_id!;
        if (!tasksByMeeting.has(meetingId)) {
          tasksByMeeting.set(meetingId, []);
        }
        tasksByMeeting.get(meetingId)!.push(task);
      }

      // Build result with tasks grouped per meeting
      return (meetings as StandupMeeting[]).map((meeting) => {
        const meetingTasks = tasksByMeeting.get(meeting.id) || [];

        // Derive attendees from unique assignees of tasks
        const attendeeMap = new Map<string, string>();
        for (const t of meetingTasks) {
          if (t.assignee) {
            const name =
              `${t.assignee.first_name || ''} ${t.assignee.last_name || ''}`.trim() || 'Unknown';
            attendeeMap.set(t.assignee.id, name);
          }
        }

        // Derive key points from task titles grouped by assignee
        const keyPoints: string[] = [];
        const byAssignee = new Map<string, string[]>();
        for (const t of meetingTasks) {
          const name = t.assignee
            ? `${t.assignee.first_name || ''} ${t.assignee.last_name || ''}`.trim()
            : 'Unassigned';
          if (!byAssignee.has(name)) byAssignee.set(name, []);
          byAssignee.get(name)!.push(t.title);
        }
        for (const [name, titles] of byAssignee) {
          keyPoints.push(`${name}: ${titles.join('; ')}`);
        }

        // Build summary
        const totalTasks = meetingTasks.length;
        const completedTasks = meetingTasks.filter((t) => t.status === 'completed').length;
        const overdueCount = meetingTasks.filter((t) => t.status === 'overdue').length;
        const summaryParts = [`${totalTasks} task${totalTasks !== 1 ? 's' : ''} assigned`];
        if (completedTasks > 0) summaryParts.push(`${completedTasks} completed`);
        if (overdueCount > 0) summaryParts.push(`${overdueCount} overdue`);

        return {
          ...meeting,
          tasks: meetingTasks,
          summary: summaryParts.join(', '),
          key_points: keyPoints.length > 0 ? keyPoints : null,
          attendees: Array.from(attendeeMap.values()),
        } as StandupMeetingWithTasks;
      });
    },
    staleTime: 60_000,
  });
}
