import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminSignaturePreference {
  id: string;
  admin_id: string;
  signature_html: string;
  signature_text: string;
  created_at: string;
  updated_at: string;
}

interface UpdateSignatureParams {
  signature_html: string;
  signature_text: string;
}

const DEFAULT_SIGNATURE = {
  html: `
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="color: #374151; font-size: 14px; line-height: 1.5;">
        <div style="font-weight: 600; margin-bottom: 4px;">Best regards,</div>
        <div style="margin-bottom: 8px;">Admin Team</div>
        <div style="font-size: 12px; color: #6b7280;">
          This email was sent regarding your marketplace activity.
        </div>
      </div>
    </div>
  `,
  text: `

---
Best regards,
Admin Team

This email was sent regarding your marketplace activity.
  `
};

export function useAdminSignature() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: signature, isLoading } = useQuery({
    queryKey: ['admin-signature'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_signature_preferences')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (!data) {
        // Return default signature if none exists
        return {
          signature_html: DEFAULT_SIGNATURE.html,
          signature_text: DEFAULT_SIGNATURE.text,
          isDefault: true
        };
      }

      return { ...data, isDefault: false };
    }
  });

  const updateSignatureMutation = useMutation({
    mutationFn: async ({ signature_html, signature_text }: UpdateSignatureParams) => {
      const { data: existingSignature } = await supabase
        .from('admin_signature_preferences')
        .select('id')
        .single();

      if (existingSignature) {
        // Update existing signature
        const { data, error } = await supabase
          .from('admin_signature_preferences')
          .update({
            signature_html,
            signature_text,
            updated_at: new Date().toISOString()
          })
          .eq('admin_id', (await supabase.auth.getUser()).data.user?.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new signature
        const { data, error } = await supabase
          .from('admin_signature_preferences')
          .insert({
            admin_id: (await supabase.auth.getUser()).data.user?.id,
            signature_html,
            signature_text
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Signature Updated',
        description: 'Your email signature has been saved successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-signature'] });
    },
    onError: (error: any) => {
      console.error('Failed to update signature:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update signature.',
      });
    }
  });

  const resetToDefaultMutation = useMutation({
    mutationFn: async () => {
      return updateSignatureMutation.mutateAsync({
        signature_html: DEFAULT_SIGNATURE.html,
        signature_text: DEFAULT_SIGNATURE.text
      });
    },
    onSuccess: () => {
      toast({
        title: 'Signature Reset',
        description: 'Your email signature has been reset to default.',
      });
    }
  });

  return {
    signature,
    isLoading,
    updateSignature: updateSignatureMutation.mutate,
    resetToDefault: resetToDefaultMutation.mutate,
    isUpdating: updateSignatureMutation.isPending || resetToDefaultMutation.isPending
  };
}