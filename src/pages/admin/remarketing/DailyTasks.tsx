import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, ClipboardList, BarChart3, Mic, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTodayTasks, useTeamMembers } from '@/hooks/daily-tasks/use-daily-tasks';
import { useDeleteTask, useUnpinTask } from '@/hooks/daily-tasks/use-task-mutations';
import { usePermissions } from '@/hooks/permissions/usePermissions';
import { TaskCard } from '@/components/daily-tasks/TaskCard';
import { AddTaskDialog } from '@/components/daily-tasks/AddTaskDialog';
import { PinTaskDialog } from '@/components/daily-tasks/PinTaskDialog';
import { TaskAnalytics } from '@/components/daily-tasks/TaskAnalytics';
import { MeetingQuality } from '@/components/daily-tasks/MeetingQuality';
import type { DailyTask, TaskTimeRange } from '@/types/daily-tasks';

type ViewFilter = 'my' | 'all';

const TIME_RANGE_OPTIONS: { key: TaskTimeRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7d' },
  { key: '14d', label: '14d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'All Time' },
];

const DailyTasks = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('my');
  const [activeTab, setActiveTab] = useState('tasks');
  const [timeRange, setTimeRange] = useState<TaskTimeRange>('30d');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<DailyTask | null>(null);
  const [analyticsMemberId, setAnalyticsMemberId] = useState<string | null>(null);

  const { isAdmin } = usePermissions();
  const { data: teamMembers = [], isLoading: membersLoading } = useTeamMembers();
  const deleteTask = useDeleteTask();
  const unpinTask = useUnpinTask();

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
        setAnalyticsMemberId(data.user.id);
      }
    });
  }, []);

  const assigneeFilter = viewFilter === 'my' ? currentUserId : null;

  // Tasks tab: show today's tasks (+ overdue)
  const {
    data: todayTasks = [],
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useTodayTasks(assigneeFilter);

  const pendingTasks = todayTasks.filter((t) => t.status !== 'completed');
  const completedTasks = todayTasks.filter((t) => t.status === 'completed');

  const handlePin = (task: DailyTask) => {
    setPinTarget(task);
    setPinDialogOpen(true);
  };

  const handleUnpin = (taskId: string) => {
    if (!currentUserId) return;
    unpinTask.mutate({ taskId, performedBy: currentUserId });
  };

  const handleDelete = (taskId: string) => {
    deleteTask.mutate(taskId);
  };

  return (
    <div className="p-6 space-y-5 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Tasks</h1>
          <p className="text-sm text-muted-foreground">
            AI-extracted tasks from your daily standup
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchTasks()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="tasks" className="gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="meeting-quality" className="gap-1.5">
                <Mic className="h-3.5 w-3.5" />
                Meeting Quality
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-2">
            {/* View filter: My vs All */}
            <div className="flex items-center gap-1 rounded-lg border bg-white p-0.5">
              <button
                onClick={() => setViewFilter('my')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewFilter === 'my' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => setViewFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewFilter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                All Tasks
              </button>
            </div>

            {/* Time range (analytics only) */}
            {activeTab !== 'tasks' && (
              <div className="flex items-center gap-1 rounded-lg border bg-white p-0.5">
                {TIME_RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTimeRange(opt.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      timeRange === opt.key
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Tasks Tab ─── */}
        <TabsContent value="tasks" className="mt-4 space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {pendingTasks.length} pending
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {completedTasks.length} completed
            </Badge>
            {todayTasks.filter((t) => t.status === 'overdue').length > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {todayTasks.filter((t) => t.status === 'overdue').length} overdue
              </Badge>
            )}
            {todayTasks.filter((t) => t.needs_review).length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {todayTasks.filter((t) => t.needs_review).length} needs review
              </Badge>
            )}
          </div>

          {tasksLoading || membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : todayTasks.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 font-medium">No tasks yet today</p>
              <p className="text-xs text-gray-400 mt-1">
                Tasks will appear after the daily standup is processed.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add a task manually
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Active tasks */}
              {pendingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  teamMembers={teamMembers}
                  currentUserId={currentUserId || undefined}
                  isLeadership={isAdmin}
                  onEdit={() => {}} // TODO: edit dialog
                  onDelete={handleDelete}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                />
              ))}

              {/* Completed tasks (collapsed) */}
              {completedTasks.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                    Completed ({completedTasks.length})
                  </p>
                  <div className="space-y-1.5">
                    {completedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        teamMembers={teamMembers}
                        currentUserId={currentUserId || undefined}
                        isLeadership={isAdmin}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── Analytics Tab ─── */}
        <TabsContent value="analytics" className="mt-4">
          <div className="space-y-4">
            {/* Member selector for individual scorecard */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Viewing:</span>
              <Select
                value={analyticsMemberId || 'all'}
                onValueChange={(v) => setAnalyticsMemberId(v === 'all' ? null : v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TaskAnalytics timeRange={timeRange} selectedMemberId={analyticsMemberId} />
          </div>
        </TabsContent>

        {/* ─── Meeting Quality Tab ─── */}
        {isAdmin && (
          <TabsContent value="meeting-quality" className="mt-4">
            <MeetingQuality timeRange={timeRange} />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <AddTaskDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        teamMembers={teamMembers}
        currentUserId={currentUserId || undefined}
      />
      <PinTaskDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        task={pinTarget}
        currentUserId={currentUserId || ''}
      />
    </div>
  );
};

export default DailyTasks;
