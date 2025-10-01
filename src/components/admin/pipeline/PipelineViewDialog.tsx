import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useDealStages } from '@/hooks/admin/use-deals';
import { useCreatePipelineView } from '@/hooks/admin/use-pipeline-views';

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

  const form = useForm<ViewFormData>({
    resolver: zodResolver(viewSchema),
    defaultValues: {
      name: '',
      description: '',
      selectedStages: stages.map(s => s.id),
      isDefault: false,
    },
  });

  const onSubmit = async (data: ViewFormData) => {
    try {
      await createView.mutateAsync({
        name: data.name,
        description: data.description || '',
        stage_config: data.selectedStages.map((stageId, index) => ({
          stageId,
          position: index,
        })),
        is_default: data.isDefault,
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create view:', error);
    }
  };

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

            <FormField
              control={form.control}
              name="selectedStages"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Select Stages</FormLabel>
                    <FormDescription>
                      Choose which stages to include in this view
                    </FormDescription>
                  </div>
                  <div className="space-y-2">
                    {stages.map((stage) => (
                      <FormField
                        key={stage.id}
                        control={form.control}
                        name="selectedStages"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={stage.id}
                              className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover:bg-muted/50 transition-colors"
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
                                <FormLabel className="font-normal cursor-pointer">
                                  {stage.name}
                                </FormLabel>
                                {stage.is_default && (
                                  <Badge variant="secondary" className="text-xs">
                                    Default
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
