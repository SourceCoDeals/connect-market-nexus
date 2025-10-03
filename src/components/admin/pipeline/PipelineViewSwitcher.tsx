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
import { LayoutGrid, Plus, MoreVertical, Trash2, Save, ArrowUpDown } from 'lucide-react';
import { usePipelineViews, useDeletePipelineView, useUpdatePipelineView } from '@/hooks/admin/use-pipeline-views';
import { PipelineViewDialog } from './PipelineViewDialog';
import { StageReorderDialog } from './StageReorderDialog';
import { useToast } from '@/hooks/use-toast';

interface PipelineViewSwitcherProps {
  currentViewId?: string;
  onViewChange: (viewId: string) => void;
  onSaveCurrentView?: () => void;
  getCurrentFilterConfig?: () => any;
  stages?: any[];
}

export function PipelineViewSwitcher({ 
  currentViewId, 
  onViewChange, 
  onSaveCurrentView, 
  getCurrentFilterConfig,
  stages = []
}: PipelineViewSwitcherProps) {
  const { data: views = [], isLoading } = usePipelineViews();
  const deleteView = useDeletePipelineView();
  const updateView = useUpdatePipelineView();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isReorderDialogOpen, setIsReorderDialogOpen] = useState(false);
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

  const handleSaveCurrentView = () => {
    if (!selectedViewId) {
      toast({
        title: "No view selected",
        description: "Please select a view to save.",
        variant: "destructive",
      });
      return;
    }

    const currentView = views.find(v => v.id === selectedViewId);
    if (!currentView) return;

    // Build stage config from current stage order
    const stage_config = stages.map((stage, index) => ({
      stageId: stage.id,
      position: index,
    }));

    // Get current filter state
    const filter_config = getCurrentFilterConfig ? getCurrentFilterConfig() : {};

    updateView.mutate({
      id: selectedViewId,
      updates: {
        stage_config,
        filter_config,
      }
    }, {
      onSuccess: () => {
        toast({
          title: "View saved",
          description: "Current stage order and filters have been saved to this view.",
        });
      }
    });
  };

  const handleSaveStageOrder = (stageConfig: { stageId: string; position: number }[]) => {
    if (!selectedViewId) return;

    const filter_config = getCurrentFilterConfig ? getCurrentFilterConfig() : {};

    updateView.mutate({
      id: selectedViewId,
      updates: {
        stage_config: stageConfig,
        filter_config,
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Stage order saved",
          description: "The custom stage order has been saved to this view.",
        });
        // Re-apply the view to reflect changes
        onViewChange(selectedViewId);
      }
    });
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
            <DropdownMenuItem onClick={handleSaveCurrentView} disabled={!selectedViewId}>
              <Save className="h-4 w-4 mr-2" />
              Save Current View
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setIsReorderDialogOpen(true)} 
              disabled={!selectedViewId || stages.length === 0}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Reorder Stages
            </DropdownMenuItem>
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

      <StageReorderDialog
        open={isReorderDialogOpen}
        onOpenChange={setIsReorderDialogOpen}
        stages={stages}
        onSave={handleSaveStageOrder}
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