import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DealAlert {
  id: string;
  user_id: string;
  name: string;
  criteria: {
    category?: string;
    categories?: string[];
    location?: string;
    locations?: string[];
    revenueMin?: number;
    revenueMax?: number;
    ebitdaMin?: number;
    ebitdaMax?: number;
    search?: string;
  };
  frequency: 'instant' | 'daily' | 'weekly';
  is_active: boolean;
  last_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDealAlertRequest {
  name: string;
  criteria: DealAlert['criteria'];
  frequency: DealAlert['frequency'];
}

export interface UpdateDealAlertRequest extends Partial<CreateDealAlertRequest> {
  is_active?: boolean;
}

// Fetch user's deal alerts
export function useDealAlerts() {
  return useQuery({
    queryKey: ['deal-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DealAlert[];
    },
  });
}

// Create a new deal alert
export function useCreateDealAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (alertData: CreateDealAlertRequest) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('deal_alerts')
        .insert({
          user_id: user.id,
          name: alertData.name,
          criteria: alertData.criteria,
          frequency: alertData.frequency,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DealAlert;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-alerts'] });
      toast({
        title: "Deal alert created",
        description: "You'll be notified when new opportunities match your criteria.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Update an existing deal alert
export function useUpdateDealAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateDealAlertRequest }) => {
      const { data, error } = await supabase
        .from('deal_alerts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DealAlert;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-alerts'] });
      toast({
        title: "Deal alert updated",
        description: "Your alert preferences have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Delete a deal alert
export function useDeleteDealAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('deal_alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-alerts'] });
      toast({
        title: "Deal alert deleted",
        description: "You will no longer receive notifications for this alert.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Toggle alert active status
export function useToggleDealAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('deal_alerts')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DealAlert;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deal-alerts'] });
      toast({
        title: data.is_active ? "Alert activated" : "Alert paused",
        description: data.is_active 
          ? "You'll receive notifications for this alert." 
          : "Notifications for this alert are paused.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}