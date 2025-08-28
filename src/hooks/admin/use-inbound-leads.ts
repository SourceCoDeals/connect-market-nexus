import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface InboundLead {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  phone_number?: string;
  role?: string;
  message?: string;
  source: 'webflow' | 'manual';
  source_form_name?: string;
  mapped_to_listing_id?: string;
  mapped_to_listing_title?: string;
  mapped_at?: string;
  mapped_by?: string;
  converted_to_request_id?: string;
  converted_at?: string;
  status: 'pending' | 'mapped' | 'converted' | 'archived';
  priority_score: number;
  created_at: string;
  updated_at: string;
}

export interface CreateInboundLeadData {
  name: string;
  email: string;
  company_name?: string;
  phone_number?: string;
  role?: string;
  message?: string;
  source: 'webflow' | 'manual';
  source_form_name?: string;
}

export interface MapLeadToListingData {
  leadId: string;
  listingId: string;
  listingTitle: string;
}

// Query hook for fetching inbound leads
export function useInboundLeadsQuery() {
  return useQuery({
    queryKey: ['inbound-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inbound_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InboundLead[];
    },
  });
}

// Mutation hook for creating inbound leads
export function useCreateInboundLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadData: CreateInboundLeadData) => {
      const { data, error } = await supabase
        .from('inbound_leads')
        .insert([leadData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      toast({
        title: "Lead created",
        description: "Inbound lead has been successfully created",
      });
    },
    onError: (error) => {
      console.error('Error creating inbound lead:', error);
      toast({
        variant: "destructive",
        title: "Failed to create lead",
        description: "Could not create the inbound lead",
      });
    },
  });
}

// Mutation hook for mapping lead to listing
export function useMapLeadToListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, listingId, listingTitle }: MapLeadToListingData) => {
      const { data, error } = await supabase
        .from('inbound_leads')
        .update({
          mapped_to_listing_id: listingId,
          mapped_to_listing_title: listingTitle,
          mapped_at: new Date().toISOString(),
          status: 'mapped',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      toast({
        title: "Lead mapped",
        description: "Lead has been successfully mapped to listing",
      });
    },
    onError: (error) => {
      console.error('Error mapping lead to listing:', error);
      toast({
        variant: "destructive",
        title: "Failed to map lead",
        description: "Could not map the lead to listing",
      });
    },
  });
}

// Mutation hook for converting lead to connection request
export function useConvertLeadToRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string) => {
      // First get the lead data
      const { data: lead, error: leadError } = await supabase
        .from('inbound_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) throw leadError || new Error('Lead not found');

      if (!lead.mapped_to_listing_id) {
        throw new Error('Lead must be mapped to a listing before conversion');
      }

      // Check if user exists in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', lead.email)
        .single();

      let userId = existingProfile?.id;

      // If no profile exists, create a minimal one
      if (!userId) {
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert([{
            email: lead.email,
            first_name: lead.name.split(' ')[0] || lead.name,
            last_name: lead.name.split(' ').slice(1).join(' ') || '',
            company: lead.company_name,
            phone_number: lead.phone_number,
            buyer_type: lead.role?.toLowerCase().includes('equity') ? 'privateEquity' : 'corporate',
            website: '',
            linkedin_profile: '',
            approval_status: 'approved', // Auto-approve for converted leads
          }])
          .select('id')
          .single();

        if (profileError) throw profileError;
        userId = newProfile.id;
      }

      // Create connection request
      const { data: connectionRequest, error: requestError } = await supabase
        .from('connection_requests')
        .insert([{
          user_id: userId,
          listing_id: lead.mapped_to_listing_id,
          user_message: lead.message || 'Converted from inbound lead',
          status: 'pending',
        }])
        .select('id')
        .single();

      if (requestError) throw requestError;

      // Update lead status
      const { error: updateError } = await supabase
        .from('inbound_leads')
        .update({
          converted_to_request_id: connectionRequest.id,
          converted_at: new Date().toISOString(),
          status: 'converted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      return connectionRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "Lead converted",
        description: "Lead has been successfully converted to a connection request",
      });
    },
    onError: (error) => {
      console.error('Error converting lead to request:', error);
      toast({
        variant: "destructive",
        title: "Failed to convert lead",
        description: error.message || "Could not convert the lead to connection request",
      });
    },
  });
}

// Mutation hook for archiving leads
export function useArchiveInboundLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase
        .from('inbound_leads')
        .update({
          status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      toast({
        title: "Lead archived",
        description: "Lead has been archived",
      });
    },
    onError: (error) => {
      console.error('Error archiving lead:', error);
      toast({
        variant: "destructive",
        title: "Failed to archive lead",
        description: "Could not archive the lead",
      });
    },
  });
}