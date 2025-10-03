import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Button } from '@/components/ui/button';
import { LayoutGrid, Plus, MoreVertical, Trash2, Save } from 'lucide-react';
import { usePipelineViews, useDeletePipelineView } from '@/hooks/admin/use-pipeline-views';
import { PipelineViewDialog } from './PipelineViewDialog';

interface PipelineViewSwitcherProps {
  currentViewId?: string;
  onViewChange: (viewId: string) => void;
  onSaveCurrentView?: () => void;
}

export function PipelineViewSwitcher({ currentViewId, onViewChange, onSaveCurrentView }: PipelineViewSwitcherProps) {
  const { data: views = [], isLoading } = usePipelineViews();
  const deleteView = useDeletePipelineView();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewToDelete, setViewToDelete] = useState<string | null>(null);

  const defaultView = views.find(v => v.is_default);
  const selectedViewId = currentViewId || defaultView?.id || views[0]?.id;

  if (isLoading) {
    return null;
  }

  const handleDeleteView = () => {
    if (viewToDelete) {
      deleteView.mutate(viewToDelete, {
        onSuccess: () => {
          // Switch to default view after deletion
          const defaultView = views.find(v => v.is_default);
          if (defaultView) {
            onViewChange(defaultView.id);
          }
          setViewToDelete(null);
        }
      });
    }
  };

  const currentView = views.find(v => v.id === selectedViewId);
  const canDeleteCurrentView = currentView && !currentView.is_default;

  return (
    <>
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        {views.length > 0 && (
          <Select value={selectedViewId} onValueChange={onViewChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {views.map((view) => (
                <SelectItem key={view.id} value={view.id}>
                  {view.name}
                  {view.is_default && ' (Default)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* View Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New View
            </DropdownMenuItem>
            {onSaveCurrentView && (
              <DropdownMenuItem onClick={onSaveCurrentView}>
                <Save className="h-4 w-4 mr-2" />
                Save Current View
              </DropdownMenuItem>
            )}
            {canDeleteCurrentView && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setViewToDelete(selectedViewId)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete View
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <PipelineViewDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!viewToDelete} onOpenChange={() => setViewToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{currentView?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteView} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}