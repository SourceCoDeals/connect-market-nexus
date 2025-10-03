import React, { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Circle, AlertTriangle, Trash2, Users } from 'lucide-react';
import { DealTask } from '@/hooks/admin/use-deal-tasks';
import { TaskStatusDialog } from './TaskStatusDialog';
import { TaskReviewersDialog } from './TaskReviewersDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TaskActionsMenuProps {
  task: DealTask;
  onStatusChange: (status: string) => void;
  onPriorityChange: (priority: string) => void;
  onDelete: () => void;
}

export function TaskActionsMenu({ task, onStatusChange, onPriorityChange, onDelete }: TaskActionsMenuProps) {
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showReviewersDialog, setShowReviewersDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPrioritySelect, setShowPrioritySelect] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setShowStatusDialog(true)}>
            <Circle className="h-4 w-4 mr-2" />
            Set Status
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowPrioritySelect(true)}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Change Priority
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowReviewersDialog(true)}>
            <Users className="h-4 w-4 mr-2" />
            Manage Reviewers
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskStatusDialog
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
        currentStatus={task.status}
        onStatusChange={onStatusChange}
      />

      <TaskReviewersDialog
        open={showReviewersDialog}
        onOpenChange={setShowReviewersDialog}
        taskId={task.id}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{task.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPrioritySelect} onOpenChange={setShowPrioritySelect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Priority</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new priority level for this task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select 
              value={task.priority} 
              onValueChange={(value) => {
                onPriorityChange(value);
                setShowPrioritySelect(false);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
