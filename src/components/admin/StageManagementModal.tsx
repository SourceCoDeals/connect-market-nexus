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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  GripVertical, 
  Edit, 
  Trash2, 
  Check, 
  X 
} from 'lucide-react';
import { useDealStages, useCreateDealStage, useUpdateDealStageData, useDeleteDealStage } from '@/hooks/admin/use-deals';
import { DealStage } from '@/hooks/admin/use-deals';

const stageSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  color: z.string().min(1, 'Color is required'),
});

type StageFormData = z.infer<typeof stageSchema>;

interface StageManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STAGE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

export const StageManagementModal = ({ open, onOpenChange }: StageManagementModalProps) => {
  const { data: stages = [], isLoading } = useDealStages();
  const createStageMutation = useCreateDealStage();
  const updateStageMutation = useUpdateDealStageData();
  const deleteStageMutation = useDeleteDealStage();
  
  const [editingStage, setEditingStage] = useState<DealStage | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const form = useForm<StageFormData>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: '',
      description: '',
      color: STAGE_COLORS[0],
    },
  });

  const editForm = useForm<StageFormData>({
    resolver: zodResolver(stageSchema),
  });

  React.useEffect(() => {
    if (editingStage) {
      editForm.reset({
        name: editingStage.name,
        description: editingStage.description || '',
        color: editingStage.color,
      });
    }
  }, [editingStage, editForm]);

  const onCreateSubmit = async (data: StageFormData) => {
    try {
      await createStageMutation.mutateAsync({
        name: data.name,
        description: data.description || '',
        color: data.color,
        position: stages.length,
      });
      form.reset();
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create stage:', error);
    }
  };

  const onEditSubmit = async (data: StageFormData) => {
    if (!editingStage) return;
    
    try {
      await updateStageMutation.mutateAsync({
        stageId: editingStage.id,
        updates: {
          name: data.name,
          description: data.description || '',
          color: data.color,
        },
      });
      setEditingStage(null);
    } catch (error) {
      console.error('Failed to update stage:', error);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (window.confirm('Are you sure you want to delete this stage? This action cannot be undone.')) {
      try {
        await deleteStageMutation.mutateAsync(stageId);
      } catch (error) {
        console.error('Failed to delete stage:', error);
      }
    }
  };

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Pipeline Stages</DialogTitle>
          <DialogDescription>
            Add, edit, and organize your deal pipeline stages. Drag to reorder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create New Stage Section */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Pipeline Stages</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Stage
              </Button>
            </div>

            {showCreateForm && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base">Create New Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Stage Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Qualified" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Color</FormLabel>
                              <div className="flex gap-2 flex-wrap">
                                {STAGE_COLORS.map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    className={`w-8 h-8 rounded-full border-2 ${
                                      field.value === color ? 'border-foreground' : 'border-border'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => field.onChange(color)}
                                  />
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Brief description of this stage"
                                className="min-h-[80px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowCreateForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createStageMutation.isPending}
                        >
                          {createStageMutation.isPending ? 'Creating...' : 'Create Stage'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Existing Stages */}
            <div className="space-y-3">
              {sortedStages.map((stage, index) => (
                <Card key={stage.id} className="relative">
                  {editingStage?.id === stage.id ? (
                    <CardContent className="p-4">
                      <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={editForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Stage Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={editForm.control}
                              name="color"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Color</FormLabel>
                                  <div className="flex gap-2 flex-wrap">
                                    {STAGE_COLORS.map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        className={`w-8 h-8 rounded-full border-2 ${
                                          field.value === color ? 'border-foreground' : 'border-border'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => field.onChange(color)}
                                      />
                                    ))}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={editForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    className="min-h-[80px]"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex justify-end space-x-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingStage(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button 
                              type="submit" 
                              size="sm"
                              disabled={updateStageMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  ) : (
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{stage.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                Position {stage.position + 1}
                              </Badge>
                              {stage.is_default && (
                                <Badge variant="secondary" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                            {stage.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {stage.description}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingStage(stage)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!stage.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteStage(stage.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                         </div>
                       </div>
                     </CardContent>
                   )}
                 </Card>
               ))}

              {sortedStages.length === 0 && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No stages found. Create your first stage to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
