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
  const { data: adminProfiles } = useAdminProfiles([]);
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
      <div className="p-6 space-y-6">
        {/* Task Summary */}
        <Card className="p-5 border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm">Task Progress</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {completedTasks} of {totalTasks} tasks completed
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">
                {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>
          
          {totalTasks > 0 && (
            <div className="mt-4">
              <div className="w-full bg-muted/50 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Create Task */}
        <Card className="p-5 border-border/40">
          {!showCreateForm ? (
            <Button 
              onClick={() => setShowCreateForm(true)}
              variant="outline" 
              className="w-full justify-start gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New Task
            </Button>
          ) : (
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Create New Task</h4>
              
              <div className="space-y-3">
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
                
                <Textarea
                  placeholder="Task description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <Select value={newTask.priority} onValueChange={(value: any) => setNewTask({ ...newTask, priority: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={newTask.assigned_to || 'unassigned'} onValueChange={(value) => setNewTask({ ...newTask, assigned_to: value === 'unassigned' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to" />
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
                </div>
                
                <Input
                  type="date"
                  placeholder="Due date (optional)"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleCreateTask}
                  disabled={!newTask.title.trim() || createTask.isPending}
                  size="sm"
                >
                  Create Task
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateForm(false)}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Tasks List */}
        <div className="space-y-3">
          {isLoading ? (
            <Card className="p-5 border-border/40">
              <div className="text-center text-muted-foreground">Loading tasks...</div>
            </Card>
          ) : sortedTasks.length === 0 ? (
            <Card className="p-5 border-border/40">
              <div className="text-center text-muted-foreground">
                <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No tasks created yet</p>
                <p className="text-xs mt-1">Create a task to get started</p>
              </div>
            </Card>
          ) : (
            sortedTasks.map((task) => {
              const StatusIcon = getStatusIcon(task.status);
              const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
              
              return (
                <Card key={task.id} className={`p-4 border-border/40 ${task.status === 'completed' ? 'opacity-60' : ''}`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => task.status !== 'completed' && handleCompleteTask(task.id)}
                          disabled={task.status === 'completed' || completeTask.isPending}
                          className="mt-0.5"
                        >
                          <StatusIcon className={`h-5 w-5 ${
                            task.status === 'completed' 
                              ? 'text-emerald-600' 
                              : 'text-muted-foreground hover:text-primary'
                          }`} />
                        </button>
                        
                        <div className="flex-1 space-y-1">
                          <h5 className={`font-medium text-sm ${task.status === 'completed' ? 'line-through' : ''}`}>
                            {task.title}
                          </h5>
                          {task.description && (
                            <p className="text-xs text-muted-foreground">{task.description}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)} border-0`}>
                          {task.priority}
                        </Badge>
                        {isOverdue && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        {task.assigned_to && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>Assigned to Admin</span>
                          </div>
                        )}
                        {task.due_date && (
                          <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
                            <Calendar className="h-3 w-3" />
                            <span>Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}</span>
                          </div>
                        )}
                      </div>
                      
                      <span>
                        {task.status === 'completed' ? 'Completed' : 'Created'} {formatDistanceToNow(new Date(task.status === 'completed' ? task.completed_at || task.created_at : task.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}