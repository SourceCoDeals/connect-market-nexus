import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface GeneratedListingContent {
  title_options?: string[];
  hero_description?: string;
  description?: string;
  investment_thesis?: string;
  custom_sections?: Array<{ title: string; description: string }>;
  services?: string[];
  growth_drivers?: string[];
  competitive_position?: string;
  ownership_structure?: string;
  seller_motivation?: string;
  business_model?: string;
  customer_geography?: string;
  customer_types?: string;
  revenue_model?: string;
  end_market_description?: string;
}

/**
 * GAP 5: Hook for AI-powered listing content generation.
 * Calls the generate-listing-content edge function.
 */
export function useGenerateListingContent() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);

  const generateContent = async (
    dealId: string,
    field?: string
  ): Promise<GeneratedListingContent | null> => {
    setIsGenerating(true);
    setGeneratingField(field || 'all');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: 'destructive', title: 'Not authenticated', description: 'Please log in to generate content.' });
        return null;
      }

      const response = await supabase.functions.invoke('generate-listing-content', {
        body: { deal_id: dealId, ...(field ? { field } : {}) },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate content');
      }

      const result = response.data;
      if (!result?.success || !result?.content) {
        throw new Error(result?.error || 'No content returned');
      }

      toast({ title: 'Content generated', description: field ? `${field} has been generated.` : 'All listing content has been generated.' });
      return result.content as GeneratedListingContent;
    } catch (err: any) {
      console.error('Generate listing content error:', err);
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: err.message || 'Failed to generate listing content. Please try again.',
      });
      return null;
    } finally {
      setIsGenerating(false);
      setGeneratingField(null);
    }
  };

  return { generateContent, isGenerating, generatingField };
}
