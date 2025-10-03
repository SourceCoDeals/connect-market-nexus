import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Plus, Minus } from 'lucide-react';
import { DealStage } from '@/hooks/admin/use-deals';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ViewStagesCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allStages: DealStage[];
  currentStageIds: string[];
  onSave: (stageIds: string[]) => void;
}

export function ViewStagesCustomizer({ 
  open, 
  onOpenChange, 
  allStages,
  currentStageIds,
  onSave 
}: ViewStagesCustomizerProps) {
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedStageIds([...currentStageIds]);
    }
  }, [open, currentStageIds]);

  const selectedStages = selectedStageIds
    .map(id => allStages.find(s => s.id === id))
    .filter(Boolean) as DealStage[];

  const availableStages = allStages.filter(s => !selectedStageIds.includes(s.id));

  const moveStageUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...selectedStageIds];
    [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    setSelectedStageIds(newOrder);
  };

  const moveStageDown = (index: number) => {
    if (index === selectedStageIds.length - 1) return;
    const newOrder = [...selectedStageIds];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setSelectedStageIds(newOrder);
  };

  const addStage = (stageId: string) => {
    setSelectedStageIds([...selectedStageIds, stageId]);
  };

  const removeStage = (stageId: string) => {
    setSelectedStageIds(selectedStageIds.filter(id => id !== stageId));
  };

  const handleSave = () => {
    if (selectedStageIds.length === 0) {
      return; // Require at least one stage
    }
    onSave(selectedStageIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize View Stages</DialogTitle>
          <DialogDescription>
            Add, remove, or reorder stages for this custom view. Changes only affect this view.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Left side: Selected stages (in view) */}
          <div className="flex flex-col gap-2 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Stages in View ({selectedStages.length})</h3>
              {selectedStageIds.length === 0 && (
                <Badge variant="destructive" className="text-xs">Required</Badge>
              )}
            </div>
            <ScrollArea className="flex-1 border rounded-md p-3">
              <div className="space-y-2">
                {selectedStages.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No stages selected. Add stages from the right panel.
                  </div>
                ) : (
                  selectedStages.map((stage, index) => (
                    <Card key={stage.id} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-sm">{stage.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Position {index + 1}
                            </div>
                          </div>
                          {stage.is_system_stage && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              System
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveStageUp(index)}
                            disabled={index === 0}
                            title="Move up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveStageDown(index)}
                            disabled={index === selectedStages.length - 1}
                            title="Move down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStage(stage.id)}
                            title="Remove from view"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <Separator orientation="vertical" className="hidden md:block" />

          {/* Right side: Available stages (not in view) */}
          <div className="flex flex-col gap-2 overflow-hidden">
            <h3 className="font-semibold text-sm">Available Stages ({availableStages.length})</h3>
            <ScrollArea className="flex-1 border rounded-md p-3">
              <div className="space-y-2">
                {availableStages.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    All stages are already in view
                  </div>
                ) : (
                  availableStages.map((stage) => (
                    <Card key={stage.id} className="p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-sm">{stage.name}</div>
                          </div>
                          {stage.is_system_stage && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              System
                            </Badge>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addStage(stage.id)}
                          title="Add to view"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={selectedStageIds.length === 0}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
