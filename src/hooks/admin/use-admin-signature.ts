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
  phone_number?: string;
  calendly_url?: string;
}

const DEFAULT_SIGNATURE = {
  signature_html: `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4;">
      <p style="margin: 0;">
        <strong>Bill Martin</strong><br>
        Principal &amp; SVP - Growth<br>
        <a href="mailto:bill.martin@sourcecodeals.com" style="color: #0066cc; text-decoration: none;">bill.martin@sourcecodeals.com</a><br>
        <a href="tel:+16148326099" style="color: #0066cc; text-decoration: none;">(614) 832-6099</a><br>
        <a href="https://calendly.com/bill-martin-sourceco/30min" style="color: #0066cc; text-decoration: none;">Click here to schedule a call with me</a>
      </p>
    </div>
  `,
  signature_text: `Bill Martin
Principal & SVP - Growth
bill.martin@sourcecodeals.com
(614) 832-6099
Click here to schedule a call with me: https://calendly.com/bill-martin-sourceco/30min`,
  phone_number: '(614) 832-6099',
  calendly_url: 'https://calendly.com/bill-martin-sourceco/30min'
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
          signature_html: DEFAULT_SIGNATURE.signature_html,
          signature_text: DEFAULT_SIGNATURE.signature_text,
          phone_number: DEFAULT_SIGNATURE.phone_number,
          calendly_url: DEFAULT_SIGNATURE.calendly_url,
          isDefault: true
        };
      }

      return { ...data, isDefault: false };
    }
  });

  const updateSignatureMutation = useMutation({
    mutationFn: async ({ signature_html, signature_text, phone_number, calendly_url }: UpdateSignatureParams) => {
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
            phone_number,
            calendly_url,
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
            signature_text,
            phone_number,
            calendly_url
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
        signature_html: DEFAULT_SIGNATURE.signature_html,
        signature_text: DEFAULT_SIGNATURE.signature_text,
        phone_number: DEFAULT_SIGNATURE.phone_number,
        calendly_url: DEFAULT_SIGNATURE.calendly_url
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