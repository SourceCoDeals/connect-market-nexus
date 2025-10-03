import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { cn } from '@/lib/utils';
import { 
  Plus, 
  GripVertical, 
  Edit, 
  Trash2, 
  Check, 
  X 
} from 'lucide-react';
import { useDealStages, useCreateDealStage, useUpdateDealStageData, useDeleteDealStage, useStageDealCount } from '@/hooks/admin/use-deals';
import { DealStage } from '@/hooks/admin/use-deals';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Lock } from 'lucide-react';

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

// Sortable Stage Card Component
interface SortableStageCardProps {
  stage: DealStage;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (data: StageFormData) => void;
  onCancel: () => void;
  editForm: any;
  dealCount?: number;
}

function SortableStageCard({ stage, isEditing, onEdit, onDelete, onSave, onCancel, editForm, dealCount = 0 }: SortableStageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={cn("relative", isDragging && "shadow-lg")}>
      {isEditing ? (
        <CardContent className="p-4">
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSave)} className="space-y-4">
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
                  onClick={onCancel}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button type="submit" size="sm">
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      ) : (
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium">{stage.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    Position {stage.position + 1}
                  </Badge>
                  {stage.is_default && (
                    <Badge variant="secondary" className="text-xs">
                      Default
                    </Badge>
                  )}
                  {stage.is_system_stage && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      System
                    </Badge>
                  )}
                  {dealCount > 0 && (
                    <Badge className="text-xs">
                      {dealCount} {dealCount === 1 ? 'deal' : 'deals'}
                    </Badge>
                  )}
                </div>
                {stage.description && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {stage.description}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                disabled={stage.is_system_stage}
                title={stage.is_system_stage ? "System stages cannot be edited" : "Edit stage"}
              >
                <Edit className="h-4 w-4" />
              </Button>
              {!stage.is_default && !stage.is_system_stage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                  title={dealCount > 0 ? `Cannot delete: ${dealCount} active deals in this stage` : "Delete stage"}
                  disabled={dealCount > 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Wrapper component to safely use hooks per stage
function StageRow({
  stage,
  isEditing,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  editForm,
}: {
  stage: DealStage;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: (dealCount: number) => void;
  onSave: (data: StageFormData) => void;
  onCancel: () => void;
  editForm: any;
}) {
  const { data: dealCount = 0 } = useStageDealCount(stage.id);
  return (
    <SortableStageCard
      stage={stage}
      isEditing={isEditing}
      onEdit={onEdit}
      onDelete={() => onDelete(dealCount)}
      onSave={onSave}
      onCancel={onCancel}
      editForm={editForm}
      dealCount={dealCount}
    />
  );
}

export const StageManagementModal = ({ open, onOpenChange }: StageManagementModalProps) => {
  const { data: stages = [], isLoading } = useDealStages(true); // Include all stages
  const createStageMutation = useCreateDealStage();
  const updateStageMutation = useUpdateDealStageData();
  const deleteStageMutation = useDeleteDealStage();
  const { toast } = useToast();
  
  const [editingStage, setEditingStage] = useState<DealStage | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [localStages, setLocalStages] = useState<DealStage[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    setLocalStages([...stages].sort((a, b) => a.position - b.position));
  }, [stages]);

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

  const handleDeleteStage = async (stageId: string, dealCount: number) => {
    const stage = localStages.find(s => s.id === stageId);
    
    if (stage?.is_system_stage) {
      toast({
        title: "Cannot delete system stage",
        description: "System stages (New Inquiry, Closed Won, Closed Lost) cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    
    if (dealCount > 0) {
      toast({
        title: "Cannot delete stage",
        description: `This stage has ${dealCount} active ${dealCount === 1 ? 'deal' : 'deals'}. Please move or delete the deals first.`,
        variant: "destructive",
      });
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this stage? This action cannot be undone.')) {
      try {
        await deleteStageMutation.mutateAsync(stageId);
        toast({
          title: "Stage deleted",
          description: "The stage has been successfully deleted.",
        });
      } catch (error: any) {
        console.error('Failed to delete stage:', error);
        toast({
          title: "Failed to delete stage",
          description: error?.message || "An error occurred while deleting the stage.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localStages.findIndex((stage) => stage.id === active.id);
    const newIndex = localStages.findIndex((stage) => stage.id === over.id);

    const newOrder = arrayMove(localStages, oldIndex, newIndex);
    setLocalStages(newOrder);

    // Update positions in database
    try {
      for (let i = 0; i < newOrder.length; i++) {
        if (newOrder[i].position !== i) {
          await updateStageMutation.mutateAsync({
            stageId: newOrder[i].id,
            updates: { position: i },
          });
        }
      }
    } catch (error) {
      console.error('Failed to update stage positions:', error);
      // Revert on error
      setLocalStages([...stages].sort((a, b) => a.position - b.position));
    }
  };

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

            {/* Existing Stages with Drag & Drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localStages.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {localStages.map((stage) => (
                    <StageRow
                      key={stage.id}
                      stage={stage}
                      isEditing={editingStage?.id === stage.id}
                      onEdit={() => {
                        if (stage.is_system_stage) {
                          toast({
                            title: "Cannot edit system stage",
                            description: "System stages have protected configurations.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setEditingStage(stage);
                      }}
                      onDelete={(dealCount) => handleDeleteStage(stage.id, dealCount)}
                      onSave={onEditSubmit}
                      onCancel={() => setEditingStage(null)}
                      editForm={editForm}
                    />
                  ))}

                  {localStages.length === 0 && !isLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No stages found. Create your first stage to get started.</p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
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
