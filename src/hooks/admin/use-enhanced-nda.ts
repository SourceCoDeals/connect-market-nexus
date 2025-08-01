import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UpdateNDAParams {
  userId: string;
  isSigned: boolean;
  adminNotes?: string;
}

interface UpdateNDAEmailParams {
  userId: string;
  isSent: boolean;
  adminNotes?: string;
}

export const useUpdateNDA = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isSigned, adminNotes }: UpdateNDAParams) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          nda_signed: isSigned,
          nda_signed_at: isSigned ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ userId, isSigned }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousUsers = queryClient.getQueryData(['admin-users']);
      const previousRequests = queryClient.getQueryData(['connection-requests']);

      // Update admin users
      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) return old;
        return old.map((user: any) => 
          user.id === userId 
            ? { 
                ...user, 
                nda_signed: isSigned,
                nda_signed_at: isSigned ? new Date().toISOString() : null 
              }
            : user
        );
      });

      // Update connection requests
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.user?.id === userId 
            ? { 
                ...request, 
                user: {
                  ...request.user,
                  nda_signed: isSigned,
                  nda_signed_at: isSigned ? new Date().toISOString() : null 
                }
              }
            : request
        );
      });

      return { previousUsers, previousRequests };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "NDA status updated",
        description: "The NDA status has been successfully updated.",
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['admin-users'], context?.previousUsers);
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update NDA status",
      });
    },
  });
};

export const useUpdateNDAEmailSent = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isSent, adminNotes }: UpdateNDAEmailParams) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          nda_email_sent: isSent,
          nda_email_sent_at: isSent ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ userId, isSent }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousUsers = queryClient.getQueryData(['admin-users']);
      const previousRequests = queryClient.getQueryData(['connection-requests']);

      // Update admin users
      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) return old;
        return old.map((user: any) => 
          user.id === userId 
            ? { 
                ...user, 
                nda_email_sent: isSent,
                nda_email_sent_at: isSent ? new Date().toISOString() : null 
              }
            : user
        );
      });

      // Update connection requests
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.user?.id === userId 
            ? { 
                ...request, 
                user: {
                  ...request.user,
                  nda_email_sent: isSent,
                  nda_email_sent_at: isSent ? new Date().toISOString() : null 
                }
              }
            : request
        );
      });

      return { previousUsers, previousRequests };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "NDA email status updated",
        description: "The NDA email status has been successfully updated.",
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['admin-users'], context?.previousUsers);
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update NDA email status",
      });
    },
  });
};