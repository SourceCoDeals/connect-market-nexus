import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRetry } from '@/hooks/use-retry';
import { User } from '@/types';

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
  recipientEmail: string;
  adminNotes?: string;
}

export const useUpdateNDA = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute } = useRetry(async (params: UpdateNDAParams) => {
    const { data, error } = await supabase.rpc('update_nda_status' as any, {
      target_user_id: params.userId,
      is_signed: params.isSigned,
      admin_notes: params.adminNotes
    });

    if (error) throw error;
    return data;
  });

  return useMutation({
    mutationFn: async ({ userId, isSigned, adminNotes }: UpdateNDAParams) => {
      return execute({ userId, isSigned, adminNotes });
    },
    onMutate: async ({ userId, isSigned }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      const previousUsers = queryClient.getQueryData(['admin-users']);

      queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
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

      return { previousUsers };
    },
    onSuccess: (_, { isSigned }) => {
      toast({
        title: 'NDA Status Updated',
        description: `NDA ${isSigned ? 'marked as signed' : 'signature revoked'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any, _, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers);
      }
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update NDA status.',
      });
    }
  });
};

export const useUpdateNDAEmailSent = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute } = useRetry(async (params: UpdateNDAEmailParams) => {
    const { data, error } = await supabase.rpc('update_nda_email_status' as any, {
      target_user_id: params.userId,
      is_sent: params.isSent,
      admin_notes: params.adminNotes
    });

    if (error) throw error;
    return data;
  });

  return useMutation({
    mutationFn: async ({ userId, isSent, adminNotes }: UpdateNDAEmailParams) => {
      return execute({ userId, isSent, adminNotes });
    },
    onMutate: async ({ userId, isSent }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      const previousUsers = queryClient.getQueryData(['admin-users']);

      queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
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

      return { previousUsers };
    },
    onSuccess: (_, { isSent }) => {
      toast({
        title: 'Email Status Updated',
        description: `NDA email ${isSent ? 'marked as sent' : 'marked as not sent'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any, _, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers);
      }
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update email status.',
      });
    }
  });
};

export const useLogNDAEmail = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute } = useRetry(async (params: LogNDAEmailParams) => {
    const { data, error } = await supabase.rpc('log_nda_email' as any, {
      target_user_id: params.userId,
      recipient_email: params.recipientEmail,
      admin_notes: params.adminNotes
    });

    if (error) throw error;
    return data;
  });

  return useMutation({
    mutationFn: async ({ userId, recipientEmail, adminNotes }: LogNDAEmailParams) => {
      return execute({ userId, recipientEmail, adminNotes });
    },
    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      const previousUsers = queryClient.getQueryData(['admin-users']);

      queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
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

      return { previousUsers };
    },
    onSuccess: () => {
      toast({
        title: 'NDA Email Logged',
        description: 'NDA email logged successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any, _, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers);
      }
      toast({
        variant: 'destructive',
        title: 'Logging Failed',
        description: error.message || 'Failed to log NDA email.',
      });
    }
  });
};