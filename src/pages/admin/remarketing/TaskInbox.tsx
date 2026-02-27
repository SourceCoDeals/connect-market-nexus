import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  CheckSquare,
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Sparkles,
  Filter,
} from 'lucide-react';
import { useRmTasks, useRmTaskCounts, type InboxView } from '@/hooks/useRmTasks';
import type {
  RmTaskWithRelations,
  RmTaskFilters,
  RmTaskEntityType,
  RmTaskPriority,
} from '@/types/rm-tasks';
import { RmTaskCard } from '@/components/rm-tasks/RmTaskCard';
import { CreateTaskDialog } from '@/components/rm-tasks/CreateTaskDialog';
import { EditTaskDialog } from '@/components/rm-tasks/EditTaskDialog';

function TaskInbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = (searchParams.get('view') as InboxView) || 'my_tasks';

  const [view, setView] = useState<InboxView>(initialView);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<RmTaskWithRelations | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RmTaskFilters>({});

  const { data: counts } = useRmTaskCounts();
  const { data: tasks, isLoading } = useRmTasks({ view, filters });

  const handleViewChange = (newView: string) => {
    setView(newView as InboxView);
    setSearchParams({ view: newView });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Manage your M&A deal tasks and follow-ups</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Open</p>
                <p className="text-2xl font-bold">{counts?.open ?? '-'}</p>
              </div>
              <CheckSquare className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Due Today</p>
                <p className="text-2xl font-bold">{counts?.dueToday ?? '-'}</p>
              </div>
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className={counts?.overdue ? 'border-red-200' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{counts?.overdue ?? '-'}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">AI Pending</p>
                <p className="text-2xl font-bold">{counts?.aiPending ?? '-'}</p>
              </div>
              <Sparkles className="h-5 w-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Filters */}
      <Tabs value={view} onValueChange={handleViewChange}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="my_tasks" className="text-xs sm:text-sm">
              My Tasks
              {counts?.open ? (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {counts.open}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="due_today" className="text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Due Today
              {counts?.dueToday ? (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {counts.dueToday}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="this_week" className="text-xs sm:text-sm">
              <Calendar className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              This Week
            </TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs sm:text-sm">
              <AlertTriangle className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Overdue
              {counts?.overdue ? (
                <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {counts.overdue}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs sm:text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Completed
            </TabsTrigger>
          </TabsList>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-accent' : ''}
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filters
          </Button>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <Card className="mt-3">
            <CardContent className="p-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Entity Type</label>
                  <Select
                    value={filters.entityType ?? 'all'}
                    onValueChange={(v) =>
                      setFilters((f) => ({
                        ...f,
                        entityType: v === 'all' ? undefined : (v as RmTaskEntityType),
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="deal">Deal</SelectItem>
                      <SelectItem value="buyer">Buyer</SelectItem>
                      <SelectItem value="contact">Contact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Priority</label>
                  <Select
                    value={filters.priority ?? 'all'}
                    onValueChange={(v) =>
                      setFilters((f) => ({
                        ...f,
                        priority: v === 'all' ? undefined : (v as RmTaskPriority),
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Date Range</label>
                  <Select
                    value={filters.dateRange ?? 'all'}
                    onValueChange={(v) =>
                      setFilters((f) => ({
                        ...f,
                        dateRange: v === 'all' ? undefined : (v as RmTaskFilters['dateRange']),
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="14d">14 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                      <SelectItem value="90d">90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {Object.values(filters).some(Boolean) && (
                  <Button variant="ghost" size="sm" className="mt-4" onClick={() => setFilters({})}>
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task list content (shared across all tabs) */}
        {['my_tasks', 'due_today', 'this_week', 'overdue', 'completed'].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <TaskList
              tasks={tasks ?? []}
              isLoading={isLoading}
              onEdit={(t) => setEditingTask(t)}
              onCreate={() => setShowCreate(true)}
              emptyMessage={getEmptyMessage(tab as InboxView)}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Dialogs */}
      <CreateTaskDialog open={showCreate} onOpenChange={setShowCreate} />
      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
      />
    </div>
  );
}

// ─── Task list sub-component ───

function TaskList({
  tasks,
  isLoading,
  onEdit,
  onCreate,
  emptyMessage,
}: {
  tasks: RmTaskWithRelations[];
  isLoading: boolean;
  onEdit: (task: RmTaskWithRelations) => void;
  onCreate: () => void;
  emptyMessage: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{emptyMessage}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Task
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <RmTaskCard key={task.id} task={task} onEdit={onEdit} showEntity />
      ))}
    </div>
  );
}

function getEmptyMessage(view: InboxView): string {
  switch (view) {
    case 'my_tasks':
      return 'No open tasks assigned to you.';
    case 'due_today':
      return 'Nothing due today. Nice!';
    case 'this_week':
      return 'No tasks due this week.';
    case 'overdue':
      return 'No overdue tasks. You are on track!';
    case 'completed':
      return 'No completed tasks yet.';
    default:
      return 'No tasks found.';
  }
}

export default TaskInbox;
