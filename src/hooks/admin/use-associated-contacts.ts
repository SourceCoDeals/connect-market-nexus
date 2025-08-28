import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AssociatedContact {
  id: string;
  primary_request_id: string;
  related_request_id: string;
  relationship_type: string;
  relationship_metadata: any; // Using any for now to handle JSON type flexibility
  created_at: string;
}

export interface CreateAssociatedContactData {
  connection_request_id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  company: string;
  source: string;
}

// Query hook for fetching associated contacts for a connection request
export function useAssociatedContactsQuery(connectionRequestId: string) {
  return useQuery<AssociatedContact[]>({
    queryKey: ['associated-contacts', connectionRequestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connection_request_contacts')
        .select('*')
        .eq('primary_request_id', connectionRequestId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!connectionRequestId,
  });
}

// Mutation hook for creating associated contacts
export function useCreateAssociatedContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactData: CreateAssociatedContactData) => {
      const { data, error } = await supabase
        .from('connection_request_contacts')
        .insert([{
          primary_request_id: contactData.connection_request_id,
          related_request_id: contactData.connection_request_id, // For now, same as primary
          relationship_type: 'same_firm',
          relationship_metadata: {
            name: contactData.name,
            email: contactData.email,
            phone: contactData.phone,
            role: contactData.role,
            company: contactData.company,
            source: contactData.source
          }
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['associated-contacts', variables.connection_request_id] 
      });
      toast({
        title: "Contact added",
        description: "Associated contact has been successfully added",
      });
    },
    onError: (error) => {
      console.error('Error creating associated contact:', error);
      toast({
        variant: "destructive",
        title: "Failed to add contact",
        description: "Could not add the associated contact",
      });
    },
  });
}