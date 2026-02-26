import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useDailyTasks, useDeleteTask } from '@/hooks/useDailyTasks';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ListChecks,
  Users,
  BarChart3,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, getLocalDateString } from '@/lib/utils';
import { TaskCard } from '@/components/daily-tasks/TaskCard';
import { AddTaskDialog } from '@/components/daily-tasks/AddTaskDialog';
import { EditTaskDialog } from '@/components/daily-tasks/EditTaskDialog';
import { ReassignDialog } from '@/components/daily-tasks/ReassignDialog';
import { PinDialog } from '@/components/daily-tasks/PinDialog';
import type { DailyStandupTaskWithRelations } from '@/types/daily-tasks';

const DailyTaskDashboard = () => {
  const { teamRole } = useAuth();
  const { toast } = useToast();
  const isLeadership = teamRole === 'owner' || teamRole === 'admin';

  const [view, setView] = useState<'my' | 'all'>('my');
  const [showCompleted, setShowCompleted] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<DailyStandupTaskWithRelations | null>(null);
  const [reassignTask, setReassignTask] = useState<DailyStandupTaskWithRelations | null>(null);
  const [pinTask, setPinTask] = useState<DailyStandupTaskWithRelations | null>(null);
  const [deleteTask, setDeleteTask] = useState<DailyStandupTaskWithRelations | null>(null);

  const deleteTaskMutation = useDeleteTask();

  const today = getLocalDateString();

  const { data: tasks, isLoading } = useDailyTasks({
    view,
    includeCompleted: showCompleted,
  });

  // Fetch team members for dialogs
  const { data: teamMembersRaw } = useQuery({
    queryKey: ['team-members-for-tasks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(id, first_name, last_name)')
        .in('role', ['owner', 'admin', 'moderator']);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((r: any) => ({
        id: r.profiles.id,
        name:
          `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() || r.profiles.id,
      }));
    },
    staleTime: 300_000,
  });
  const teamMembers = teamMembersRaw || [];

  // Task stats
  const stats = useMemo(() => {
    if (!tasks) return { total: 0, completed: 0, overdue: 0, pending: 0 };
    return {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      overdue: tasks.filter((t) => t.status === 'overdue').length,
      pending: tasks.filter((t) => t.status === 'pending').length,
    };
  }, [tasks]);

  const todayTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => t.due_date === today || t.status === 'overdue');
  }, [tasks, today]);

  const futureTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => t.due_date > today && t.status !== 'overdue');
  }, [tasks, today]);

  const completedTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => t.status === 'completed');
  }, [tasks]);

  const handleDelete = async () => {
    if (!deleteTask) return;
    try {
      await deleteTaskMutation.mutateAsync(deleteTask.id);
      setDeleteTask(null);
    } catch (err) {
      toast({
        title: 'Failed to delete task',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      setDeleteTask(null);
    }
  };

  return (
    <div className="px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Today's Tasks</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Extracted from standup meetings, ranked by priority
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/daily-tasks/analytics">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </Link>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <ListChecks className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stats.pending + stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Open Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border bg-white p-0.5">
          <button
            onClick={() => setView('my')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              view === 'my'
                ? 'bg-gray-900 text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Users className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
            My Tasks
          </button>
          <button
            onClick={() => setView('all')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              view === 'all'
                ? 'bg-gray-900 text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ListChecks className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
            All Tasks
          </button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-xs"
        >
          {showCompleted ? 'Hide Completed' : 'Show Completed'}
        </Button>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ListChecks className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              No tasks yet today. Tasks will appear after the daily standup is processed.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Manual Task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="today" className="space-y-3">
          <TabsList>
            <TabsTrigger value="today" className="gap-1.5">
              Today & Overdue
              {todayTasks.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {todayTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            {futureTasks.length > 0 && (
              <TabsTrigger value="upcoming" className="gap-1.5">
                Upcoming
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {futureTasks.length}
                </Badge>
              </TabsTrigger>
            )}
            {showCompleted && completedTasks.length > 0 && (
              <TabsTrigger value="completed" className="gap-1.5">
                Completed
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {completedTasks.length}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="today" className="space-y-2">
            {todayTasks.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tasks due today. Great job!
                </CardContent>
              </Card>
            ) : (
              todayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isLeadership={isLeadership}
                  onEdit={setEditTask}
                  onReassign={setReassignTask}
                  onPin={setPinTask}
                  onDelete={setDeleteTask}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-2">
            {futureTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isLeadership={isLeadership}
                onEdit={setEditTask}
                onReassign={setReassignTask}
                onPin={setPinTask}
                onDelete={setDeleteTask}
              />
            ))}
          </TabsContent>

          {showCompleted && (
            <TabsContent value="completed" className="space-y-2">
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isLeadership={isLeadership}
                  onEdit={setEditTask}
                  onReassign={setReassignTask}
                  onPin={setPinTask}
                  onDelete={setDeleteTask}
                />
              ))}
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Dialogs */}
      <AddTaskDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        teamMembers={teamMembers}
      />
      <EditTaskDialog
        task={editTask}
        open={!!editTask}
        onOpenChange={(open) => !open && setEditTask(null)}
      />
      <ReassignDialog
        task={reassignTask}
        open={!!reassignTask}
        onOpenChange={(open) => !open && setReassignTask(null)}
        teamMembers={teamMembers}
      />
      <PinDialog
        task={pinTask}
        open={!!pinTask}
        onOpenChange={(open) => !open && setPinTask(null)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTask} onOpenChange={(open) => !open && setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTask?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DailyTaskDashboard;
