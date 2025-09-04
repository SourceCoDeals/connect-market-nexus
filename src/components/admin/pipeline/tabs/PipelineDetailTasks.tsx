import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CheckCircle2, Circle, Clock, User, Calendar, AlertTriangle } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useDealTasks, useCreateDealTask, useUpdateDealTask, useCompleteDealTask, useDeleteDealTask, DealTask } from '@/hooks/admin/use-deal-tasks';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { formatDistanceToNow } from 'date-fns';

interface PipelineDetailTasksProps {
  deal: Deal;
}

export function PipelineDetailTasks({ deal }: PipelineDetailTasksProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assigned_to: '',
    due_date: ''
  });

  const { data: tasks = [], isLoading } = useDealTasks(deal.deal_id);
  const { data: adminProfiles } = useAdminProfiles();
  const createTask = useCreateDealTask();
  const updateTask = useUpdateDealTask();
  const completeTask = useCompleteDealTask();
  const deleteTask = useDeleteDealTask();

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    await createTask.mutateAsync({
      deal_id: deal.deal_id,
      title: newTask.title,
      description: newTask.description || undefined,
      priority: newTask.priority,
      assigned_to: newTask.assigned_to || undefined,
      due_date: newTask.due_date || undefined
    });

    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      assigned_to: '',
      due_date: ''
    });
    setShowCreateForm(false);
  };

  const handleCompleteTask = (taskId: string) => {
    completeTask.mutate(taskId);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle2;
      case 'in_progress': return Clock;
      default: return Circle;
    }
  };

  const sortedTasks = tasks.sort((a, b) => {
    // Completed tasks go to bottom
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    
    // Sort by priority then due date
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    
    // Sort by due date
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-5 space-y-6">
        {/* Task Summary - Apple Minimal */}
        <div className="flex items-center justify-between py-2">
          <div>
            <h4 className="font-medium text-sm text-foreground">Task Progress</h4>
            <p className="text-xs text-muted-foreground/70">
              {completedTasks} of {totalTasks} completed
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-foreground">
              {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Create Task - Minimal */}
        <div className="py-3">
          {!showCreateForm ? (
            <Button 
              onClick={() => setShowCreateForm(true)}
              variant="ghost" 
              className="w-full justify-start gap-2 text-left font-normal"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="text-sm"
              />
              
              <Textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={2}
                className="text-sm"
              />
              
              <div className="grid grid-cols-3 gap-2">
                <Select value={newTask.priority} onValueChange={(value: any) => setNewTask({ ...newTask, priority: value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={newTask.assigned_to || 'unassigned'} onValueChange={(value) => setNewTask({ ...newTask, assigned_to: value === 'unassigned' ? '' : value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Assign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {adminProfiles && Object.values(adminProfiles).map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleCreateTask}
                  disabled={!newTask.title.trim() || createTask.isPending}
                  size="sm"
                  className="h-7 text-xs"
                >
                  Create
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateForm(false)}
                  size="sm"
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tasks List - Clean Design */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Loading tasks...</div>
          ) : sortedTasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Circle className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tasks yet</p>
            </div>
          ) : (
            sortedTasks.map((task) => {
              const StatusIcon = getStatusIcon(task.status);
              const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
              
              return (
                <div key={task.id} className={`py-4 ${task.status === 'completed' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => task.status !== 'completed' && handleCompleteTask(task.id)}
                      disabled={task.status === 'completed' || completeTask.isPending}
                      className="mt-0.5"
                    >
                      <StatusIcon className={`h-4 w-4 ${
                        task.status === 'completed' 
                          ? 'text-emerald-600' 
                          : 'text-muted-foreground hover:text-primary'
                      }`} />
                    </button>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h5 className={`font-medium text-sm ${task.status === 'completed' ? 'line-through' : ''}`}>
                          {task.title}
                        </h5>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)} border-0 px-2 py-0`}>
                            {task.priority}
                          </Badge>
                          {isOverdue && (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                      </div>
                      
                      {task.description && (
                        <p className="text-xs text-muted-foreground">{task.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {task.assigned_to && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>Assigned</span>
                          </div>
                        )}
                        {task.due_date && (
                          <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
                            <Calendar className="h-3 w-3" />
                            <span>Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}</span>
                          </div>
                        )}
                        <span>
                          {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}