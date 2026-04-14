import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, untypedFrom } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractFunctionError } from '@/hooks/email/useEmailConnection';
import type { CreateThesisCriteriaInput } from '@/types/portal';

/**
 * One AI-proposed thesis row. These are shown to the admin for review in the
 * ExtractThesisDialog — nothing is persisted until the admin approves a subset.
 */
export interface ExtractedThesisCandidate {
  industry_label: string;
  industry_keywords: string[];
  ebitda_min: number | null;
  ebitda_max: number | null;
  revenue_min: number | null;
  revenue_max: number | null;
  employee_min: number | null;
  employee_max: number | null;
  target_states: string[];
  priority: number;
  notes: string | null;
  confidence: number;
  source_excerpt: string | null;
}

export interface ExtractThesisResponse {
  success: boolean;
  portal_org_id: string;
  portal_intelligence_doc_id: string;
  theses: ExtractedThesisCandidate[];
  overall_confidence: number | null;
  extraction_notes: string | null;
  error?: string;
}

/**
 * Call the `extract-portal-thesis` edge function against an existing
 * portal_intelligence_docs row. Returns the AI-proposed thesis rows so the
 * caller can show them for review before writing anything to the database.
 *
 * This mutation intentionally does NOT invalidate the thesis cache — persistence
 * is the job of `useSaveExtractedTheses` below, which runs after admin approval.
 *
 * Errors are shown inline in the dialog (via `mutation.error`) rather than as a
 * toast, so there's no duplicate notification for the user.
 */
export function useExtractPortalThesis() {
  return useMutation({
    mutationFn: async (portalIntelligenceDocId: string): Promise<ExtractThesisResponse> => {
      const { data, error } = await supabase.functions.invoke<ExtractThesisResponse>(
        'extract-portal-thesis',
        {
          body: { portal_intelligence_doc_id: portalIntelligenceDocId },
        },
      );

      if (error) {
        // `supabase.functions.invoke` flattens FunctionsHttpError.message to
        // "Edge Function returned a non-2xx status code" — dig the real error
        // string out of the response body instead.
        const msg = await extractFunctionError(error, 'Failed to extract thesis from document');
        throw new Error(msg);
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Extraction returned no data');
      }
      return data;
    },
  });
}

/**
 * Persist a reviewer-approved subset of extracted theses as rows in
 * `portal_thesis_criteria`. Invalidates the thesis query cache so the Thesis
 * tab shows the new rows immediately.
 */
export function useSaveExtractedTheses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      portalOrgId,
      theses,
    }: {
      portalOrgId: string;
      theses: CreateThesisCriteriaInput[];
    }) => {
      if (theses.length === 0) return { portalOrgId, count: 0 };
      const rows = theses.map((t) => ({ ...t, portal_org_id: portalOrgId, is_active: true }));
      const { error } = await untypedFrom('portal_thesis_criteria').insert(rows);
      if (error) throw error;
      return { portalOrgId, count: rows.length };
    },
    onSuccess: ({ portalOrgId, count }) => {
      qc.invalidateQueries({ queryKey: ['portal-thesis-criteria', portalOrgId] });
      if (count > 0) {
        toast.success(`Added ${count} thesis ${count === 1 ? 'criterion' : 'criteria'} from document`);
      }
    },
    onError: (err: Error) => {
      toast.error('Failed to save extracted theses', { description: err.message });
    },
  });
}
