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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, Plus, MoreVertical, Trash2, Save, ArrowUpDown, Settings2 } from 'lucide-react';
import { usePipelineViews, useDeletePipelineView, useUpdatePipelineView } from '@/hooks/admin/use-pipeline-views';
import { PipelineViewDialog } from './PipelineViewDialog';
import { StageReorderDialog } from './StageReorderDialog';
import { ViewStagesCustomizer } from './ViewStagesCustomizer';
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
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [viewToDelete, setViewToDelete] = useState<string | null>(null);

  const defaultView = views.find(v => v.is_default);
  const selectedViewId = currentViewId || defaultView?.id || views[0]?.id;

  const currentView = views.find(v => v.id === selectedViewId);
  const canDeleteCurrentView = currentView && !currentView.is_default;
  
  // Determine if this is Standard Pipeline (no stage_config or empty array)
  const isStandardPipeline = currentView && (!currentView.stage_config || currentView.stage_config.length === 0);
  const isCustomView = currentView && !isStandardPipeline;

  // Get current stage IDs for this view
  const currentStageIds = currentView?.stage_config && currentView.stage_config.length > 0
    ? currentView.stage_config.map((sc: any) => sc.stageId)
    : stages.map(s => s.id);

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

    // Prevent saving Standard Pipeline
    if (isStandardPipeline) {
      toast({
        title: "Cannot Modify Standard Pipeline",
        description: "Standard Pipeline shows all stages and cannot be customized. Create a custom view instead.",
        variant: "destructive",
      });
      return;
    }

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
          title: "View Saved",
          description: `Stage order, filters, and sorting saved to "${currentView.name}".`,
        });
      }
    });
  };

  const handleSaveStageOrder = async (stageConfig: { stageId: string; position: number }[]) => {
    if (!selectedViewId) return;

    // Check if this is the Standard Pipeline
    if (isStandardPipeline) {
      toast({
        title: 'Cannot Reorder Standard Pipeline',
        description: 'The Standard Pipeline shows all stages in their global order. Create a custom view to reorder stages.',
        variant: 'destructive',
      });
      return;
    }

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

  const handleCustomizeStages = async (stageIds: string[]) => {
    if (!selectedViewId) return;

    const stageConfig = stageIds.map((stageId, index) => ({
      stageId,
      position: index,
    }));

    updateView.mutate({
      id: selectedViewId,
      updates: {
        stage_config: stageConfig,
      }
    }, {
      onSuccess: () => {
        toast({
          title: 'Stages Updated',
          description: 'View stages have been customized successfully.',
        });
        // Re-apply the view
        onViewChange(selectedViewId);
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: `Failed to customize stages: ${error.message}`,
          variant: 'destructive',
        });
      }
    });
  };

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
        
        {/* Default View Badge */}
        {isStandardPipeline && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs">
                  Default View
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  This view shows all stages in global order and cannot be customized. Create a custom view for personalized stage order and filters.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenuItem 
                      onClick={handleSaveCurrentView} 
                      disabled={!selectedViewId || isStandardPipeline}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Current View
                      {isStandardPipeline && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Default
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                {isStandardPipeline && (
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">
                      Standard Pipeline cannot be customized. Create a custom view to save stage order and filters.
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            
            <DropdownMenuSeparator />
            
            {/* Customize Stages - only for custom views */}
            {isCustomView && (
              <DropdownMenuItem onClick={() => setIsCustomizeDialogOpen(true)}>
                <Settings2 className="h-4 w-4 mr-2" />
                Add/Remove Stages
              </DropdownMenuItem>
            )}
            
            {/* Reorder Stages - disabled for Standard Pipeline with tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenuItem 
                      onClick={() => {
                        if (!isStandardPipeline) {
                          setIsReorderDialogOpen(true);
                        }
                      }}
                      disabled={isStandardPipeline || !selectedViewId || stages.length === 0}
                    >
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Reorder Stages
                      {isStandardPipeline && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Global
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                {isStandardPipeline && (
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">
                      Standard Pipeline shows all stages in global order. Create a custom view to reorder stages.
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            
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

      <ViewStagesCustomizer
        open={isCustomizeDialogOpen}
        onOpenChange={setIsCustomizeDialogOpen}
        allStages={stages}
        currentStageIds={currentStageIds}
        onSave={handleCustomizeStages}
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
