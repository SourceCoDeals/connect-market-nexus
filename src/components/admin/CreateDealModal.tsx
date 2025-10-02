import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDealStages, useCreateDeal } from '@/hooks/admin/use-deals';
import { useListingsQuery } from '@/hooks/admin/listings/use-listings-query';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { logDealActivity } from '@/lib/deal-activity-logger';
import { useToast } from '@/hooks/use-toast';
import { startOfToday } from 'date-fns';

// Schema
const createDealSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  stage_id: z.string().uuid('Please select a stage'),
  listing_id: z.string().uuid('Please select a listing'),
  contact_name: z.string().min(1, 'Contact name is required').max(100),
  contact_email: z.string().email('Invalid email').max(255),
  contact_company: z.string().max(150).optional(),
  contact_phone: z.string().max(50).optional(),
  contact_role: z.string().max(100).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  value: z.number().min(0).optional(),
  probability: z.number().min(0).max(100).optional(),
  expected_close_date: z.date().optional(),
  assigned_to: z.union([z.string().uuid(), z.literal('')]).optional(),
});

type CreateDealFormData = z.infer<typeof createDealSchema>;

interface CreateDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledStageId?: string;
  onDealCreated?: (dealId: string) => void;
}

interface DuplicateDeal {
  id: string;
  title: string;
  contact_name: string;
  created_at: string;
}

export function CreateDealModal({ open, onOpenChange, prefilledStageId, onDealCreated }: CreateDealModalProps) {
  const { data: stages } = useDealStages();
  const { data: listings } = useListingsQuery('active');
  const { data: adminProfilesMap } = useAdminProfiles();
  const adminUsers = adminProfilesMap ? Object.values(adminProfilesMap) : [];
  const createDealMutation = useCreateDeal();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [duplicates, setDuplicates] = useState<DuplicateDeal[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingData, setPendingData] = useState<CreateDealFormData | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const form = useForm<CreateDealFormData>({
    resolver: zodResolver(createDealSchema),
    defaultValues: {
      title: '',
      description: '',
      stage_id: prefilledStageId || stages?.[0]?.id || '',
      listing_id: '',
      contact_name: '',
      contact_email: '',
      contact_company: '',
      contact_phone: '',
      contact_role: '',
      priority: 'medium',
      value: undefined,
      probability: 50,
      expected_close_date: undefined,
      assigned_to: undefined,
    },
  });

  // Update stage when prefilledStageId changes
  useEffect(() => {
    if (prefilledStageId) {
      form.setValue('stage_id', prefilledStageId);
    }
  }, [prefilledStageId, form]);

  // Watch for stage changes to auto-populate probability
  const selectedStageId = form.watch('stage_id');
  
  useEffect(() => {
    if (selectedStageId && stages) {
      const selectedStage = stages.find(stage => stage.id === selectedStageId);
      if (selectedStage && selectedStage.default_probability !== undefined) {
        form.setValue('probability', selectedStage.default_probability);
      }
    }
  }, [selectedStageId, stages, form]);

  // Check for duplicates
  const checkDuplicates = async (email: string, listingId: string): Promise<DuplicateDeal[]> => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('id, title, contact_name, created_at')
        .eq('contact_email', email)
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return [];
    }
  };

  const handleFormSubmit = async (data: CreateDealFormData) => {
    // Check for duplicates
    setIsCheckingDuplicates(true);
    const foundDuplicates = await checkDuplicates(data.contact_email, data.listing_id);
    setIsCheckingDuplicates(false);

    if (foundDuplicates.length > 0) {
      setDuplicates(foundDuplicates);
      setPendingData(data);
      setShowDuplicateWarning(true);
      return;
    }

    // No duplicates, proceed with creation
    await createDeal(data);
  };

  const createDeal = async (data: CreateDealFormData) => {
    try {
      const payload: any = {
        ...data,
        source: 'manual',
        nda_status: 'not_sent',
        fee_agreement_status: 'not_sent',
        buyer_priority_score: 0,
        assigned_to: data.assigned_to && data.assigned_to !== '' ? data.assigned_to : null,
      };
      const newDeal = await createDealMutation.mutateAsync(payload);

      // Log activity
      if (newDeal?.id) {
        await logDealActivity({
          dealId: newDeal.id,
          activityType: 'deal_created',
          title: 'Deal Created',
          description: `Deal "${data.title}" was created manually`,
        });
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });

      // Show success toast (useCreateDeal already shows one, so we suppress it)
      toast({
        title: 'Deal Created',
        description: `"${data.title}" has been added to your pipeline.`,
      });

      // Auto-select the newly created deal
      if (newDeal?.id && onDealCreated) {
        onDealCreated(newDeal.id);
      }

      // Reset and close
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating deal:', error);
      // Error toast already shown by useCreateDeal
    }
  };

  const handleCreateAnyway = async () => {
    if (pendingData) {
      setShowDuplicateWarning(false);
      await createDeal(pendingData);
      setPendingData(null);
      setDuplicates([]);
    }
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateWarning(false);
    setPendingData(null);
    setDuplicates([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <DialogDescription>
              Add a new deal to your pipeline. All deals must be associated with a listing.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deal Title *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Acquisition opportunity with ABC Corp" 
                          autoFocus
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="listing_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Listing *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select listing" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {listings?.map((listing) => (
                              <SelectItem key={listing.id} value={listing.id}>
                                {listing.title} {listing.internal_company_name && `(${listing.internal_company_name})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stage_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pipeline Stage *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stages?.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: stage.color }}
                                  />
                                  {stage.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deal Value ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            value={field.value || ''}
                          />
                        </FormControl>
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add notes about this deal..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Details about the buyer/prospect interested in this listing. No user account will be created.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contact_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contact_company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Corp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+1 (555) 000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="contact_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role/Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., CEO, Managing Partner" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Additional Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="probability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Win Probability (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            max="100" 
                            placeholder="Auto-set by stage"
                            {...field}
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Auto-populated based on selected pipeline stage
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expected_close_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Close Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP')
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-[100]" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < startOfToday()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Deal Owner (Admin)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {adminUsers?.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.first_name} {admin.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Which admin team member will manage this deal?
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={createDealMutation.isPending || isCheckingDuplicates}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createDealMutation.isPending || isCheckingDuplicates}
                >
                  {(createDealMutation.isPending || isCheckingDuplicates) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isCheckingDuplicates ? 'Checking...' : 'Create Deal'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Possible Duplicate Deal Found
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                A deal with the same contact email and listing already exists:
              </p>
              <div className="bg-muted p-3 rounded-md space-y-2">
                {duplicates.map((dup) => (
                  <div key={dup.id} className="text-sm">
                    <div className="font-medium text-foreground">{dup.title}</div>
                    <div className="text-muted-foreground">
                      Contact: {dup.contact_name} • Created: {format(new Date(dup.created_at), 'PP')}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm">
                Do you want to create this deal anyway? This might represent a new opportunity from the same contact.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDuplicate}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateAnyway}>
              Create Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
