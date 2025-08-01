import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRetry } from '@/hooks/use-retry';

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

interface LogNDAEmailParams {
  userId: string;
  userEmail: string;
  adminNotes?: string;
}

export const useUpdateNDA = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isSigned, adminNotes }: UpdateNDAParams) => {
      const { data, error } = await supabase.rpc('update_nda_status', {
        target_user_id: userId,
        is_signed: isSigned,
        admin_notes: adminNotes
      });

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
      // Invalidate queries to get fresh data from backend
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
      const { data, error } = await supabase.rpc('update_nda_email_status', {
        target_user_id: userId,
        is_sent: isSent,
        admin_notes: adminNotes
      });

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
      // Invalidate queries to get fresh data from backend
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

export const useLogNDAEmail = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, userEmail, adminNotes }: LogNDAEmailParams) => {
      // Send actual email via edge function
      const { data, error } = await supabase.functions.invoke('send-nda-email', {
        body: {
          userId,
          userEmail,
          adminEmail: 'adam.haile@sourcecodeals.com',
          adminName: 'Adam Haile'
        }
      });

      if (error) throw error;
      
      // Also log to database
      const { data: logData, error: logError } = await supabase.rpc('log_nda_email', {
        target_user_id: userId,
        recipient_email: userEmail,
        admin_notes: adminNotes
      });

      if (logError) throw logError;
      return logData;
    },
    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousUsers = queryClient.getQueryData(['admin-users']);
      const previousRequests = queryClient.getQueryData(['connection-requests']);

      // Optimistically update NDA email sent status
      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) return old;
        return old.map((user: any) => 
          user.id === userId 
            ? { 
                ...user, 
                nda_email_sent: true,
                nda_email_sent_at: new Date().toISOString() 
              }
            : user
        );
      });

      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.user?.id === userId 
            ? { 
                ...request, 
                user: {
                  ...request.user,
                  nda_email_sent: true,
                  nda_email_sent_at: new Date().toISOString()
                }
              }
            : request
        );
      });

      return { previousUsers, previousRequests };
    },
    onSuccess: () => {
      // Invalidate queries to get fresh data from backend
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "NDA email sent successfully",
        description: "The NDA email has been sent and logged.",
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['admin-users'], context?.previousUsers);
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Email logging failed",
        description: "Could not log the NDA email",
      });
    },
  });
};