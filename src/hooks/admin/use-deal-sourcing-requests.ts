import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DealSourcingRequest {
  id: string;
  user_id: string;
  buyer_type: string | null;
  business_categories: string[] | null;
  target_locations: string[] | null;
  revenue_min: string | null;
  revenue_max: string | null;
  investment_thesis: string | null;
  custom_message: string | null;
  additional_notes: string | null;
  status: string;
  assigned_to: string | null;
  followed_up_at: string | null;
  admin_notes: string | null;
  converted_to_deal_id: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  user_company?: string;
  assigned_admin_name?: string;
}

export interface DealSourcingFilters {
  status?: string;
  buyerType?: string;
  assignedTo?: string;
  hasCustomMessage?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export const useDealSourcingRequests = (filters?: DealSourcingFilters) => {
  return useQuery({
    queryKey: ['deal-sourcing-requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('deal_sourcing_requests')
        .select(`
          *,
          profiles:user_id (
            email,
            first_name,
            last_name,
            company_name
          ),
          assigned_admin:assigned_to (
            email,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.buyerType) {
        query = query.eq('buyer_type', filters.buyerType);
      }

      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      if (filters?.hasCustomMessage) {
        query = query.not('custom_message', 'is', null);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to include user info
      return (data || []).map((request: any) => ({
        ...request,
        user_email: request.profiles?.email,
        user_name: request.profiles?.first_name && request.profiles?.last_name
          ? `${request.profiles.first_name} ${request.profiles.last_name}`
          : request.profiles?.email,
        user_company: request.profiles?.company_name,
        assigned_admin_name: request.assigned_admin?.first_name && request.assigned_admin?.last_name
          ? `${request.assigned_admin.first_name} ${request.assigned_admin.last_name}`
          : request.assigned_admin?.email,
      })) as DealSourcingRequest[];
    },
  });
};

export const useUpdateDealSourcingRequest = () => {
  return async (id: string, updates: Partial<DealSourcingRequest>) => {
    const { error } = await supabase
      .from('deal_sourcing_requests')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  };
};
