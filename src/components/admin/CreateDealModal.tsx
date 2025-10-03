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
import { Badge } from '@/components/ui/badge';
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
import { CalendarIcon, Loader2, AlertTriangle, User, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDealStages, useCreateDeal } from '@/hooks/admin/use-deals';
import { useListingsQuery } from '@/hooks/admin/listings/use-listings-query';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useMarketplaceUsers } from '@/hooks/admin/use-marketplace-users';
import { useMarketplaceCompanies } from '@/hooks/admin/use-marketplace-companies';
import { Combobox } from '@/components/ui/combobox';
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
  const { data: marketplaceUsers } = useMarketplaceUsers();
  const { data: marketplaceCompanies } = useMarketplaceCompanies();
  const adminUsers = adminProfilesMap ? Object.values(adminProfilesMap) : [];
  const createDealMutation = useCreateDeal();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [duplicates, setDuplicates] = useState<DuplicateDeal[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingData, setPendingData] = useState<CreateDealFormData | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isSelectingUser, setIsSelectingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null);
  const [autoPopulatedFrom, setAutoPopulatedFrom] = useState<{
    source: 'user' | 'company';
    name: string;
    email: string;
  } | null>(null);

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
      let connectionRequestId = null;
      
      // If user was selected from marketplace, create connection request first
      if (selectedUserId && data.listing_id) {
        // Check for existing connection request
        const { data: existingRequests, error: checkError } = await supabase
          .from('connection_requests')
          .select('id')
          .eq('user_id', selectedUserId)
          .eq('listing_id', data.listing_id)
          .limit(1);
        
        if (checkError) throw checkError;
        
        if (existingRequests && existingRequests.length > 0) {
          // Use existing connection request
          connectionRequestId = existingRequests[0].id;
          toast({
            title: 'Using Existing Connection',
            description: 'This user already has a connection request for this listing.',
          });
        } else {
          // Create new connection request
          const { data: newConnectionRequest, error: crError } = await supabase
            .from('connection_requests')
            .insert({
              user_id: selectedUserId,
              listing_id: data.listing_id,
              status: 'approved',
              source: 'manual',
              user_message: data.description || 'Manual connection created by admin',
              source_metadata: {
                created_by_admin: true,
                admin_id: (await supabase.auth.getUser()).data.user?.id,
                created_via: 'deal_creation_modal',
                deal_title: data.title,
              },
            })
            .select()
            .single();
          
          if (crError) throw crError;
          connectionRequestId = newConnectionRequest.id;
        }
      }
      
      const payload: any = {
        ...data,
        source: 'manual',
        nda_status: 'not_sent',
        fee_agreement_status: 'not_sent',
        buyer_priority_score: 0,
        assigned_to: data.assigned_to && data.assigned_to !== '' ? data.assigned_to : null,
        connection_request_id: connectionRequestId,
      };
      const newDeal = await createDealMutation.mutateAsync(payload);

      // Phase 4: Auto-create connection request associations for same company
      if (connectionRequestId && data.contact_company) {
        try {
          // Find profiles with this company
          const { data: companyProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('company', data.contact_company)
            .eq('approval_status', 'approved');
          
          if (companyProfiles && companyProfiles.length > 0) {
            const userIds = companyProfiles.map(p => p.id);
            
            // Find other connection requests from users in this company OR with same company name
            const { data: sameCompanyRequests } = await supabase
              .from('connection_requests')
              .select('id')
              .neq('id', connectionRequestId)
              .or(`user_id.in.(${userIds.join(',')}),lead_company.eq.${data.contact_company}`);
            
            if (sameCompanyRequests && sameCompanyRequests.length > 0) {
              // Create bidirectional associations
              const associations = sameCompanyRequests.flatMap(req => [
                {
                  primary_request_id: connectionRequestId,
                  related_request_id: req.id,
                  relationship_type: 'same_company',
                  relationship_metadata: {
                    company_name: data.contact_company,
                    auto_created: true,
                    created_at: new Date().toISOString(),
                  },
                },
                {
                  primary_request_id: req.id,
                  related_request_id: connectionRequestId,
                  relationship_type: 'same_company',
                  relationship_metadata: {
                    company_name: data.contact_company,
                    auto_created: true,
                    created_at: new Date().toISOString(),
                  },
                },
              ]);
              
              const { error: assocError } = await supabase
                .from('connection_request_contacts')
                .upsert(associations, { 
                  onConflict: 'primary_request_id,related_request_id',
                  ignoreDuplicates: true 
                });
              
              if (assocError) {
                console.error('[CreateDealModal] Failed to create associations:', assocError);
              } else {
                console.log('[CreateDealModal] Created', associations.length / 2, 'bidirectional associations');
              }
            }
          }
        } catch (err) {
          console.error('[CreateDealModal] Error creating associations:', err);
          // Don't fail the entire deal creation if associations fail
        }
      }

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
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['associated-requests'] }); // Invalidate all associated requests
      if (selectedUserId) {
        queryClient.invalidateQueries({ queryKey: ['user-connection-requests', selectedUserId] });
      }

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
      setIsSelectingUser(false);
      setSelectedUserId(null);
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

  // Handle user selection
  const handleUserSelect = (userId: string) => {
    const user = marketplaceUsers?.find(u => u.id === userId);
    if (user) {
      setSelectedUserId(userId);
      form.setValue('contact_name', `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email);
      form.setValue('contact_email', user.email);
      form.setValue('contact_company', user.company || '');
    }
  };

  const handleToggleUserSelection = () => {
    if (isSelectingUser) {
      // Switching back to manual entry
      setSelectedUserId(null);
      setSelectedCompanyName(null);
      form.setValue('contact_name', '');
      form.setValue('contact_email', '');
      form.setValue('contact_company', '');
      form.setValue('contact_phone', '');
      form.setValue('contact_role', '');
    }
    setIsSelectingUser(!isSelectingUser);
  };

  // Handle company selection
  const handleCompanySelect = (companyName: string) => {
    setSelectedCompanyName(companyName);
    form.setValue('contact_company', companyName);
    
    // Auto-populate from profile template if existing company
    const selectedCompany = marketplaceCompanies?.find(c => c.value === companyName);
    if (selectedCompany?.profileTemplate) {
      const template = selectedCompany.profileTemplate;
      
      // Only auto-fill if field is empty
      if (!form.getValues('contact_phone') && template.phone_number) {
        form.setValue('contact_phone', template.phone_number);
      }
      
      setAutoPopulatedFrom({
        source: 'company',
        name: companyName,
        email: template.sampleUserEmail,
      });
      
      console.log('[CreateDealModal] Auto-populated fields from company template:', template);
    }
  };

  // Helper function to generate comprehensive search terms with prefixes
  const generateSearchTerms = (words: string[]): string => {
    const terms = new Set<string>();
    
    words.forEach(word => {
      const cleaned = word.toLowerCase().trim();
      if (!cleaned) return;
      
      // Add full word
      terms.add(cleaned);
      
      // Add progressive prefixes (for "Tucker's" -> "t", "tu", "tuc", "tuck", etc.)
      for (let i = 1; i <= cleaned.length; i++) {
        terms.add(cleaned.substring(0, i));
      }
    });
    
    return Array.from(terms).join(' ');
  };

  // Format user options for combobox
  const userOptions = React.useMemo(() => {
    if (!marketplaceUsers || marketplaceUsers.length === 0) {
      console.log('[CreateDealModal] No marketplace users available');
      return [];
    }
    
    console.log('[CreateDealModal] Formatting', marketplaceUsers.length, 'marketplace users for combobox');
    
    return marketplaceUsers.map(user => {
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      const name = `${firstName} ${lastName}`.trim() || user.email;
      const buyerType = user.buyer_type ? ` - ${user.buyer_type}` : '';
      const company = user.company ? ` (${user.company})` : '';
      
      // Generate comprehensive search terms
      const searchParts = [
        firstName,
        lastName,
        name,
        user.email,
        user.company || '',
        user.buyer_type || '',
        // Split company name into words for better matching
        ...(user.company ? user.company.split(/\s+/) : []),
      ].filter(Boolean);
      
      return {
        value: user.id,
        label: `${name} - ${user.email}${buyerType}${company}`,
        searchTerms: generateSearchTerms(searchParts),
      };
    });
  }, [marketplaceUsers]);

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
              {/* Auto-Population Notice */}
              {autoPopulatedFrom && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        📋 Auto-populated from {autoPopulatedFrom.source === 'user' ? 'user profile' : 'company profile'}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Contact details were automatically filled using data from <strong>{autoPopulatedFrom.name}</strong> ({autoPopulatedFrom.email})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Clear auto-filled fields
                        if (autoPopulatedFrom && autoPopulatedFrom.source === 'company') {
                          form.setValue('contact_phone', '');
                        }
                        setAutoPopulatedFrom(null);
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium"
                    >
                      Clear & Dismiss
                    </button>
                  </div>
                </div>
              )}
              
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
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isSelectingUser 
                        ? 'Select an existing marketplace user or switch to manual entry'
                        : 'Enter contact details manually or select an existing user'
                      }
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleUserSelection}
                    className="gap-2"
                  >
                    {isSelectingUser ? (
                      <>
                        <UserPlus className="h-4 w-4" />
                        New Contact
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4" />
                        Select User
                      </>
                    )}
                  </Button>
                </div>

                {isSelectingUser ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Marketplace User *</label>
                      <Combobox
                        options={userOptions}
                        value={selectedUserId || ''}
                        onValueChange={handleUserSelect}
                        placeholder="Search by name, email, or company..."
                        emptyText="No marketplace users found"
                        searchPlaceholder="Search users..."
                      />
                      {selectedUserId && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {marketplaceUsers?.find(u => u.id === selectedUserId)?.buyer_type || 'Buyer'}
                          </Badge>
                          <span>User will be linked to this deal</span>
                        </div>
                      )}
                    </div>

                    {selectedUserId && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Contact Name</label>
                          <Input value={form.watch('contact_name')} disabled className="bg-muted/50" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Email</label>
                          <Input value={form.watch('contact_email')} disabled className="bg-muted/50" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Company</label>
                          <Input value={form.watch('contact_company')} disabled className="bg-muted/50" />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                
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
                        <div className="space-y-2">
                          <FormControl>
                            <Combobox
                              options={marketplaceCompanies?.map(c => ({
                                value: c.value,
                                label: c.label,
                                searchTerms: c.searchTerms,
                              })) || []}
                              value={field.value || ''}
                              onValueChange={(value) => {
                                handleCompanySelect(value);
                                field.onChange(value);
                              }}
                              placeholder="Select or type company name..."
                              emptyText="No companies found"
                              searchPlaceholder="Search companies..."
                              allowCustomValue={true}
                              onCustomValueCreate={(newCompany) => {
                                console.log('[CreateDealModal] Creating new company:', newCompany);
                              }}
                            />
                          </FormControl>
                          
                          {/* Show metadata if existing company selected */}
                          {selectedCompanyName && marketplaceCompanies && (() => {
                            const companyData = marketplaceCompanies.find(c => c.value === selectedCompanyName);
                            if (!companyData) return null;
                            
                            return (
                              <div className="text-xs bg-muted/50 p-2 rounded-md space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {companyData.userCount} existing user{companyData.userCount !== 1 ? 's' : ''}
                                  </Badge>
                                  {companyData.buyerTypes.map(type => (
                                    <Badge key={type} variant="secondary" className="text-xs capitalize">
                                      {type}
                                    </Badge>
                                  ))}
                                </div>
                                <div className="text-muted-foreground">
                                  Users: {companyData.userEmails.slice(0, 3).join(', ')}
                                  {companyData.userEmails.length > 3 && ` +${companyData.userEmails.length - 3} more`}
                                </div>
                              </div>
                            );
                          })()}
                          
                          <FormDescription className="text-xs">
                            Select an existing company or type a new one
                          </FormDescription>
                        </div>
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
                  </>
                )}
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
