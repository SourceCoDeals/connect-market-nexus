import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, CheckCircle2, Circle, Clock, User, Calendar, AlertTriangle, Check } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useDealTasks, useCreateDealTask, useUpdateDealTask, useCompleteDealTask, useDeleteDealTask, DealTask, useTaskReviewers } from '@/hooks/admin/use-deal-tasks';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { formatDistanceToNow } from 'date-fns';
import { TaskActionsMenu } from './task-management/TaskActionsMenu';

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

  const handleStatusChange = (taskId: string, status: string) => {
    updateTask.mutate({ 
      taskId, 
      updates: { status: status as any }
    });
  };

  const handlePriorityChange = (taskId: string, priority: string) => {
    updateTask.mutate({ 
      taskId, 
      updates: { priority: priority as any }
    });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask.mutate(taskId);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-gray-500';
      case 'in_progress': return 'bg-amber-500';
      case 'reopened': return 'bg-purple-500';
      case 'na': return 'bg-gray-500';
      case 'resolved': return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'reopened': return 'Reopened';
      case 'na': return 'NA';
      case 'resolved': return 'Resolved';
      default: return status;
    }
  };

  const sortedTasks = tasks.sort((a, b) => {
    // Resolved tasks go to bottom
    if (a.status === 'resolved' && b.status !== 'resolved') return 1;
    if (a.status !== 'resolved' && b.status === 'resolved') return -1;
    
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

  const completedTasks = tasks.filter(t => t.status === 'resolved').length;
  const totalTasks = tasks.length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 space-y-8 pb-8">
        {/* Task Progress Summary - Apple Clean */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Task Progress</h2>
          
          <div className="flex items-center justify-between py-3">
            <div className="space-y-1">
              <p className="text-2xl font-light text-foreground">
                {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
              </p>
              <p className="text-xs text-muted-foreground/70 font-mono">
                {completedTasks} of {totalTasks} completed
              </p>
            </div>
            
            <div className="w-24 h-1 bg-muted/40 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Add Task - Minimal */}
        <div className="space-y-4">
          {!showCreateForm ? (
            <button 
              onClick={() => setShowCreateForm(true)}
              className="w-full text-left py-4 px-6 border border-border/40 rounded-xl hover:border-border/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary/40" />
                <span className="text-sm text-muted-foreground">Add Task</span>
              </div>
            </button>
          ) : (
            <div className="space-y-6 p-6 border border-border/40 rounded-xl">
              <Input
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="border-0 bg-muted/20 focus:bg-muted/30"
              />
              
              <Textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
                className="border-0 bg-muted/20 focus:bg-muted/30"
              />
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground/70">Priority</label>
                  <Select value={newTask.priority} onValueChange={(value: any) => setNewTask({ ...newTask, priority: value })}>
                    <SelectTrigger className="border-0 bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground/70">Assign to</label>
                  <Select value={newTask.assigned_to || 'unassigned'} onValueChange={(value) => setNewTask({ ...newTask, assigned_to: value === 'unassigned' ? '' : value })}>
                    <SelectTrigger className="border-0 bg-muted/20">
                      <SelectValue />
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
                
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground/70">Due date</label>
                  <Input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    className="border-0 bg-muted/20"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  onClick={handleCreateTask}
                  disabled={!newTask.title.trim() || createTask.isPending}
                  className="h-8 px-4 text-xs"
                >
                  Create Task
                </Button>
                <button 
                  onClick={() => setShowCreateForm(false)}
                  className="h-8 px-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tasks List - Apple Minimal */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Active Tasks</h2>
          
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="text-sm text-muted-foreground/70">Loading tasks...</div>
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mx-auto">
                <Circle className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">No tasks yet</p>
                <p className="text-xs text-muted-foreground/70">Create your first task to get started</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTasks.map((task) => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'resolved';
                
                return (
                  <div key={task.id} className={`p-4 border border-border/20 rounded-xl ${task.status === 'resolved' ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)}`} />
                        <span className="text-xs text-muted-foreground/70 min-w-[80px]">
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <h3 className={`text-sm font-medium ${task.status === 'resolved' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-xs text-muted-foreground/70">{task.description}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono px-2 py-1 rounded-md ${
                              task.priority === 'high' ? 'bg-red-50 text-red-700' :
                              task.priority === 'medium' ? 'bg-amber-50 text-amber-700' :
                              'bg-emerald-50 text-emerald-700'
                            }`}>
                              {task.priority}
                            </span>
                            {isOverdue && (
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                            )}
                            <TaskActionsMenu 
                              task={task}
                              onStatusChange={(status) => handleStatusChange(task.id, status)}
                              onPriorityChange={(priority) => handlePriorityChange(task.id, priority)}
                              onDelete={() => handleDeleteTask(task.id)}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 text-xs text-muted-foreground/70">
                          {task.assigned_to && adminProfiles && (
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              <span className="font-mono">
                                {adminProfiles[task.assigned_to]?.displayName || 'Assigned'}
                              </span>
                            </div>
                          )}
                          {task.due_date && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              <span className={`font-mono ${isOverdue ? 'text-red-600' : ''}`}>
                                Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span className="font-mono">
                              {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}