import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UpdateSignatureParams {
  signature_html: string;
  signature_text: string;
  phone_number?: string;
  calendly_url?: string;
}

const DEFAULT_SIGNATURE = {
  signature_html:
    '[Your Name]<br>[Your Title]<br>[Your Email]<br>[Your Phone - Optional]<br>[Your Calendly Link - Optional]',
  signature_text: `[Your Name]
[Your Title]
[Your Email]
[Your Phone - Optional]
[Your Calendly Link - Optional]`,
  phone_number: '',
  calendly_url: '',
};

export function useAdminSignature() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: signature, isLoading } = useQuery({
    queryKey: ['admin-signature'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_signature_preferences')
        .select('signature_html, signature_text, phone_number, calendly_url')
        .eq('admin_id', (await supabase.auth.getUser()).data.user?.id ?? '')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        throw error;
      }

      if (!data) {
        // Return default signature if none exists
        return {
          signature_html: DEFAULT_SIGNATURE.signature_html,
          signature_text: DEFAULT_SIGNATURE.signature_text,
          phone_number: DEFAULT_SIGNATURE.phone_number,
          calendly_url: DEFAULT_SIGNATURE.calendly_url,
          isDefault: true,
        };
      }

      return { ...data, isDefault: false };
    },
  });

  const updateSignatureMutation = useMutation({
    mutationFn: async ({
      signature_html,
      signature_text,
      phone_number,
      calendly_url,
    }: UpdateSignatureParams) => {
      const { data: existingSignature, error: existingSignatureError } = await supabase
        .from('admin_signature_preferences')
        .select('id')
        .single();
      if (existingSignatureError) throw existingSignatureError;

      if (existingSignature) {
        // Update existing signature
        const { data, error } = await supabase
          .from('admin_signature_preferences')
          .update({
            signature_html,
            signature_text,
            phone_number,
            calendly_url,
            updated_at: new Date().toISOString(),
          })
          .eq('admin_id', (await supabase.auth.getUser()).data.user?.id ?? '')
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new signature
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) throw new Error('Not authenticated');
        const { data, error } = await supabase
          .from('admin_signature_preferences')
          .insert({
            admin_id: userId,
            signature_html,
            signature_text,
            phone_number,
            calendly_url,
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
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update signature.',
      });
    },
  });

  const resetToDefaultMutation = useMutation({
    mutationFn: async () => {
      return updateSignatureMutation.mutateAsync({
        signature_html: DEFAULT_SIGNATURE.signature_html,
        signature_text: DEFAULT_SIGNATURE.signature_text,
        phone_number: DEFAULT_SIGNATURE.phone_number,
        calendly_url: DEFAULT_SIGNATURE.calendly_url,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Signature Reset',
        description: 'Your email signature has been reset to default.',
      });
    },
  });

  return {
    signature,
    isLoading,
    updateSignature: updateSignatureMutation.mutate,
    resetToDefault: resetToDefaultMutation.mutate,
    isUpdating: updateSignatureMutation.isPending || resetToDefaultMutation.isPending,
  };
}
