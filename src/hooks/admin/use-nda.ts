import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
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
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, isSigned, adminNotes }: UpdateNDAParams) => {
      console.log('Updating NDA status:', { userId, isSigned, adminNotes });
      
      const { data, error } = await supabase.rpc('update_nda_status' as any, {
        target_user_id: userId,
        is_signed: isSigned,
        admin_notes: adminNotes
      });
      
      if (error) {
        console.error('Error updating NDA status:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: (_, { isSigned }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`NDA ${isSigned ? 'marked as signed' : 'signature revoked'}`);
    },
    onError: (error: any) => {
      console.error('Failed to update NDA status:', error);
      toast.error(`Failed to update NDA status: ${error.message}`);
    }
  });
};

export const useUpdateNDAEmailSent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, isSent, adminNotes }: UpdateNDAEmailParams) => {
      console.log('Updating NDA email status:', { userId, isSent, adminNotes });
      
      const { data, error } = await supabase.rpc('update_nda_email_status' as any, {
        target_user_id: userId,
        is_sent: isSent,
        admin_notes: adminNotes
      });
      
      if (error) {
        console.error('Error updating NDA email status:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: (_, { isSent }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`NDA email ${isSent ? 'marked as sent' : 'status revoked'}`);
    },
    onError: (error: any) => {
      console.error('Failed to update NDA email status:', error);
      toast.error(`Failed to update NDA email status: ${error.message}`);
    }
  });
};

export const useLogNDAEmail = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, recipientEmail, adminNotes }: LogNDAEmailParams) => {
      console.log('Logging NDA email:', { userId, recipientEmail, adminNotes });
      
      const { data, error } = await supabase.rpc('log_nda_email' as any, {
        target_user_id: userId,
        recipient_email: recipientEmail,
        admin_notes: adminNotes
      });
      
      if (error) {
        console.error('Error logging NDA email:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('NDA email logged successfully');
    },
    onError: (error: any) => {
      console.error('Failed to log NDA email:', error);
      toast.error(`Failed to log NDA email: ${error.message}`);
    }
  });
};