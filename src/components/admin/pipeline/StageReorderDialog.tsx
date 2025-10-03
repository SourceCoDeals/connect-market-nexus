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
import { ArrowUp, ArrowDown } from 'lucide-react';
import { DealStage } from '@/hooks/admin/use-deals';

interface StageReorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: DealStage[];
  onSave: (stageConfig: { stageId: string; position: number }[]) => void;
}

export function StageReorderDialog({ 
  open, 
  onOpenChange, 
  stages,
  onSave 
}: StageReorderDialogProps) {
  const [orderedStages, setOrderedStages] = useState<DealStage[]>([]);

  useEffect(() => {
    if (open) {
      // Initialize with current stage order
      setOrderedStages([...stages]);
    }
  }, [open, stages]);

  const moveStageUp = (index: number) => {
    if (index === 0) return;
    
    const newOrder = [...orderedStages];
    [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    setOrderedStages(newOrder);
  };

  const moveStageDown = (index: number) => {
    if (index === orderedStages.length - 1) return;
    
    const newOrder = [...orderedStages];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrderedStages(newOrder);
  };

  const handleSave = () => {
    const stageConfig = orderedStages.map((stage, index) => ({
      stageId: stage.id,
      position: index,
    }));
    onSave(stageConfig);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reorder Stages for this View</DialogTitle>
          <DialogDescription>
            Customize the order of stages for the current pipeline view. This won't affect other views.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4 max-h-[60vh] overflow-y-auto">
          {orderedStages.map((stage, index) => (
            <Card key={stage.id} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{stage.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Position {index + 1}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveStageUp(index)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveStageDown(index)}
                    disabled={index === orderedStages.length - 1}
                    title="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
