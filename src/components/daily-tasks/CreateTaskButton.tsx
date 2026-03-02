/**
 * CreateTaskButton — Salesforce-style quick "New Task" action for entity detail pages.
 *
 * Opens a popover form with Subject, Task Type, Assigned To, Due Date, and Priority.
 * Creates a task linked to the current entity (deal or buyer).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useAddEntityTask } from '@/hooks/useTaskActions';
import { supabase } from '@/integrations/supabase/client';
import { getLocalDateString } from '@/lib/utils';
import { TASK_TYPE_OPTIONS } from '@/types/daily-tasks';
import type { TaskEntityType, TaskType, TaskPriority } from '@/types/daily-tasks';

interface CreateTaskButtonProps {
  entityType: TaskEntityType;
  entityId: string;
  entityName?: string;
  dealId?: string;
}

export function CreateTaskButton({
  entityType,
  entityId,
  entityName,
  dealId,
}: CreateTaskButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('other');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState(getLocalDateString());
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const { toast } = useToast();
  const { user } = useAuth();
  const addTask = useAddEntityTask();

  // Fetch team members for the "Assigned To" dropdown
  const { data: teamMembers } = useQuery({
    queryKey: ['team-member-registry'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role, profiles!inner(id, first_name, last_name, email)')
        .in('role', ['owner', 'admin', 'moderator']);

      return (
        (roles || []) as unknown as Array<{
          user_id: string;
          role: string;
          profiles: {
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string;
          };
        }>
      ).map((r) => ({
        id: r.user_id,
        name: `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() || r.profiles.email,
      }));
    },
    staleTime: 60_000,
  });

  const resetForm = () => {
    setTitle('');
    setTaskType('other');
    setAssigneeId(user?.id || '');
    setDueDate(getLocalDateString());
    setPriority('medium');
  };

  // Default assignee to current user when popover opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAssigneeId(user?.id || '');
      setDueDate(getLocalDateString());
    }
    setOpen(nextOpen);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    try {
      await addTask.mutateAsync({
        title: title.trim(),
        assignee_id: assigneeId || null,
        task_type: taskType,
        due_date: dueDate,
        priority,
        entity_type: entityType,
        entity_id: entityId,
        deal_id: dealId || (entityType === 'deal' ? entityId : null),
      });

      toast({ title: 'Task created', description: title.trim() });
      resetForm();
      setOpen(false);
    } catch (err) {
      toast({
        title: 'Failed to create task',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <ListPlus className="h-3.5 w-3.5" />
          New Task
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <p className="text-sm font-medium">
            New Task{entityName ? ` — ${entityName}` : ''}
          </p>

          {/* Subject */}
          <div className="space-y-1">
            <Label htmlFor="task-subject" className="text-xs">
              Subject *
            </Label>
            <Input
              id="task-subject"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Follow up on NDA"
              className="h-8 text-xs"
            />
          </div>

          {/* Task Type + Priority */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Task Type</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high" className="text-xs">High</SelectItem>
                  <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                  <SelectItem value="low" className="text-xs">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned To */}
          <div className="space-y-1">
            <Label className="text-xs">Assigned To</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {(teamMembers || []).map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-1">
            <Label htmlFor="task-due-date" className="text-xs">
              Due Date
            </Label>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Save */}
          <Button
            size="sm"
            className="w-full text-xs"
            disabled={!title.trim() || addTask.isPending}
            onClick={handleSubmit}
          >
            {addTask.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
