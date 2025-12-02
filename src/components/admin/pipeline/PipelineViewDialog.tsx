import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v3';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useDealStages } from '@/hooks/admin/use-deals';
import { useCreatePipelineView } from '@/hooks/admin/use-pipeline-views';
import { ScrollArea } from '@/components/ui/scroll-area';

const viewSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  selectedStages: z.array(z.string()).min(1, 'Select at least one stage'),
  isDefault: z.boolean().default(false),
});

type ViewFormData = z.infer<typeof viewSchema>;

interface PipelineViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PipelineViewDialog({ open, onOpenChange }: PipelineViewDialogProps) {
  const { data: stages = [] } = useDealStages();
  const createView = useCreatePipelineView();
  const [orderedStageIds, setOrderedStageIds] = useState<string[]>([]);

  const form = useForm<ViewFormData>({
    resolver: zodResolver(viewSchema as any),
    defaultValues: {
      name: '',
      description: '',
      selectedStages: stages.map(s => s.id),
      isDefault: false,
    },
  });

  // Initialize ordered stages when dialog opens or stages load
  useEffect(() => {
    if (open && stages.length > 0) {
      const currentSelected = form.getValues('selectedStages');
      if (currentSelected.length > 0) {
        setOrderedStageIds(currentSelected);
      } else {
        setOrderedStageIds(stages.map(s => s.id));
      }
    }
  }, [open, stages]);

  // Update ordered stages when selection changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'selectedStages' && value.selectedStages) {
        // Keep order, but add new selections to end and remove deselected
        const newSelected = value.selectedStages;
        const currentOrdered = orderedStageIds.filter(id => newSelected.includes(id));
        const newIds = newSelected.filter(id => !orderedStageIds.includes(id));
        setOrderedStageIds([...currentOrdered, ...newIds]);
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, orderedStageIds]);

  const moveStageUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...orderedStageIds];
    [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    setOrderedStageIds(newOrder);
  };

  const moveStageDown = (index: number) => {
    if (index === orderedStageIds.length - 1) return;
    const newOrder = [...orderedStageIds];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrderedStageIds(newOrder);
  };

  const onSubmit = async (data: ViewFormData) => {
    try {
      // Use the ordered stage IDs instead of the raw selected stages
      await createView.mutateAsync({
        name: data.name,
        description: data.description || '',
        stage_config: orderedStageIds
          .filter(id => data.selectedStages.includes(id))
          .map((stageId, index) => ({
            stageId,
            position: index,
          })),
        is_default: data.isDefault,
      });
      form.reset();
      setOrderedStageIds([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create view:', error);
    }
  };

  const orderedSelectedStages = orderedStageIds
    .map(id => stages.find(s => s.id === id))
    .filter(stage => stage && form.watch('selectedStages')?.includes(stage.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Pipeline View</DialogTitle>
          <DialogDescription>
            Create a custom view with specific stages to organize your pipeline.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>View Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Active Deals, Closing Soon" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of this view..."
                      className="min-h-[60px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="selectedStages"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Select & Order Stages</FormLabel>
                      <FormDescription>
                        Choose stages and drag to reorder them for this view
                      </FormDescription>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                      {stages.map((stage) => (
                        <FormField
                          key={stage.id}
                          control={form.control}
                          name="selectedStages"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={stage.id}
                                className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-2 hover:bg-muted/50 transition-colors"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(stage.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, stage.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== stage.id
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <div className="flex items-center gap-2 flex-1">
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: stage.color }}
                                  />
                                  <FormLabel className="font-normal cursor-pointer text-sm">
                                    {stage.name}
                                  </FormLabel>
                                  {stage.is_system_stage && (
                                    <Badge variant="secondary" className="text-xs">
                                      System
                                    </Badge>
                                  )}
                                </div>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Stage Order Preview */}
              {orderedSelectedStages.length > 0 && (
                <div className="space-y-2">
                  <FormLabel className="text-base">Stage Order Preview</FormLabel>
                  <FormDescription className="text-xs">
                    Use arrows to reorder. This is how stages will appear in your view.
                  </FormDescription>
                  <ScrollArea className="max-h-[250px] border rounded-md p-3">
                    <div className="space-y-2">
                      {orderedSelectedStages.map((stage, index) => {
                        if (!stage) return null;
                        return (
                          <Card key={stage.id} className="p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{stage.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Position {index + 1}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveStageUp(index)}
                                  disabled={index === 0}
                                  title="Move up"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveStageDown(index)}
                                  disabled={index === orderedSelectedStages.length - 1}
                                  title="Move down"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Set as Default View
                    </FormLabel>
                    <FormDescription>
                      This view will be shown by default when opening the pipeline
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createView.isPending}
              >
                {createView.isPending ? 'Creating...' : 'Create View'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
