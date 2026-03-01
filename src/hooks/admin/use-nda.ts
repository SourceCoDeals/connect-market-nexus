import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { APP_CONFIG } from '@/config/app';


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
  notes?: string;
  customSubject?: string;
  customMessage?: string;
  customSignatureText?: string;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
  listingTitle?: string;
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
      type AdminUser = { id: string; nda_signed: boolean; nda_signed_at: string | null };
      type ConnectionRequestEntry = { user?: { id: string; nda_signed: boolean; nda_signed_at: string | null } };

      queryClient.setQueryData(['admin-users'], (old: AdminUser[] | undefined) => {
        if (!old) return old;
        return old.map((user) =>
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
      queryClient.setQueryData(['connection-requests'], (old: ConnectionRequestEntry[] | undefined) => {
        if (!old) return old;
        return old.map((request) =>
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
      queryClient.invalidateQueries({ queryKey: ['connection-request-details'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      toast({
        title: "NDA status updated",
        description: "The NDA status has been successfully updated.",
      });
    },
    onError: (_err, _variables, context) => {
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
      type AdminUser = { id: string; nda_email_sent: boolean; nda_email_sent_at: string | null };
      type ConnectionRequestEntry = { user?: { id: string; nda_email_sent: boolean; nda_email_sent_at: string | null } };

      queryClient.setQueryData(['admin-users'], (old: AdminUser[] | undefined) => {
        if (!old) return old;
        return old.map((user) =>
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
      queryClient.setQueryData(['connection-requests'], (old: ConnectionRequestEntry[] | undefined) => {
        if (!old) return old;
        return old.map((request) =>
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
      queryClient.invalidateQueries({ queryKey: ['connection-request-details'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      toast({
        title: "NDA email status updated",
        description: "The NDA email status has been successfully updated.",
      });
    },
    onError: (_err, _variables, context) => {
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
    mutationFn: async ({ 
      userId,
      userEmail,
      notes: _notes,
      customSubject,
      customMessage, 
      customSignatureText, 
      adminId, 
      adminEmail, 
      adminName, 
      listingTitle 
    }: LogNDAEmailParams) => {
      // Send email via edge function (which also handles database logging)
      const { data, error } = await supabase.functions.invoke('send-nda-email', {
        body: {
          userId,
          userEmail,
          customSubject,
          customMessage,
          customSignatureText,
          adminId,
          adminEmail: adminEmail || APP_CONFIG.adminEmail,
          adminName: adminName || 'Adam Haile',
          listingTitle,
          useTemplate: !customMessage // Use template only if no custom message
        }
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onMutate: async ({ userId: _userId }) => {
      // Don't do optimistic updates since edge function handles database changes
      // Just store previous data for rollback purposes
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousUsers = queryClient.getQueryData(['admin-users']);
      const previousRequests = queryClient.getQueryData(['connection-requests']);

      return { previousUsers, previousRequests };
    },
    onSuccess: () => {
      // Add a delay to ensure edge function database updates have completed
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      }, 1000);
      
      toast({
        title: "NDA email sent successfully",
        description: "The NDA email has been sent and logged.",
      });
    },
    onError: (_err, _variables, context) => {
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