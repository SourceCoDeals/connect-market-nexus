 import { useEffect, useRef, useState } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useQueryClient } from '@tanstack/react-query';
 import { toast } from 'sonner';
 
 /**
  * Auto-Enrichment Hook per Deal Page System Spec
  * 
  * Triggers automatic enrichment when:
  * 1. last_enriched_at > 24 hours ago
  * 2. Key fields missing (executive_summary < 50 chars, address_city empty, geographic_states empty)
  * 3. Has sources available (website or internal_deal_memo_link)
  */
 
 interface AutoEnrichmentConfig {
   dealId: string;
   deal: {
     id: string;
     website?: string | null;
     internal_deal_memo_link?: string | null;
     last_enriched_at?: string | null;
     enriched_at?: string | null;
     executive_summary?: string | null;
     address_city?: string | null;
     geographic_states?: string[] | null;
   } | null;
   enabled?: boolean;
 }
 
 interface AutoEnrichmentResult {
   isAutoEnriching: boolean;
   shouldAutoEnrich: boolean;
   enrichmentReason: string | null;
   triggerEnrichment: () => Promise<void>;
 }
 
 const CACHE_DURATION_HOURS = 24;
 const MIN_SUMMARY_LENGTH = 50;
 
 export function useAutoEnrichment({
   dealId,
   deal,
   enabled = true,
 }: AutoEnrichmentConfig): AutoEnrichmentResult {
   const queryClient = useQueryClient();
   const [isAutoEnriching, setIsAutoEnriching] = useState(false);
   const hasTriggeredRef = useRef(false);
 
   // Check if deal has a usable website source
   const hasWebsiteSource = (): boolean => {
     if (!deal) return false;
     
     // Direct website field
     if (deal.website && !deal.website.includes('sharepoint.com') && !deal.website.includes('onedrive')) {
       return true;
     }
     
     // Check internal_deal_memo_link for website
     if (deal.internal_deal_memo_link) {
       const memoLink = deal.internal_deal_memo_link;
       if (memoLink.includes('sharepoint.com') || memoLink.includes('onedrive')) {
         return false;
       }
       // Has extractable URL
       if (memoLink.match(/Website:\s*https?:\/\//i) || 
           memoLink.match(/^https?:\/\/[a-zA-Z0-9]/) ||
           memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) {
         return true;
       }
     }
     
     return false;
   };
 
   // Determine if auto-enrichment should trigger
   const checkShouldAutoEnrich = (): { shouldEnrich: boolean; reason: string | null } => {
     if (!deal || !enabled) {
       return { shouldEnrich: false, reason: null };
     }
 
     // Must have a website source
     if (!hasWebsiteSource()) {
       return { shouldEnrich: false, reason: null };
     }
 
     const enrichedAt = deal.last_enriched_at || deal.enriched_at;
     const now = new Date();
     
     // Check 1: Never enriched
     if (!enrichedAt) {
       return { shouldEnrich: true, reason: 'Never enriched' };
     }
     
     // Check 2: Stale (> 24 hours)
     const lastEnrichedDate = new Date(enrichedAt);
     const hoursSinceEnriched = (now.getTime() - lastEnrichedDate.getTime()) / (1000 * 60 * 60);
     
     if (hoursSinceEnriched > CACHE_DURATION_HOURS) {
       return { shouldEnrich: true, reason: `Stale (${Math.round(hoursSinceEnriched)}h since last enrichment)` };
     }
     
     // Check 3: Missing key fields
     const missingFields: string[] = [];
     
     if (!deal.executive_summary || deal.executive_summary.length < MIN_SUMMARY_LENGTH) {
       missingFields.push('executive_summary');
     }
     if (!deal.address_city) {
       missingFields.push('address_city');
     }
     if (!deal.geographic_states || deal.geographic_states.length === 0) {
       missingFields.push('geographic_states');
     }
     
     if (missingFields.length > 0) {
       return { shouldEnrich: true, reason: `Missing fields: ${missingFields.join(', ')}` };
     }
     
     return { shouldEnrich: false, reason: null };
   };
 
   const { shouldEnrich, reason } = checkShouldAutoEnrich();
 
   // Trigger enrichment
   const triggerEnrichment = async () => {
     if (!dealId || isAutoEnriching) return;
     
     setIsAutoEnriching(true);
     console.log(`[AutoEnrich] Triggering for deal ${dealId}: ${reason}`);
     
     try {
       const { data, error } = await supabase.functions.invoke('enrich-deal', {
         body: { dealId }
       });
 
       if (error) throw error;
 
       if (data?.success) {
         const fieldsCount = data.fieldsUpdated?.length || 0;
         if (fieldsCount > 0) {
           toast.success(`Auto-enriched ${fieldsCount} fields`, {
             description: reason || 'Updated from website',
             duration: 3000,
           });
         }
         queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
       } else {
         console.warn('[AutoEnrich] Failed:', data?.error);
         // Surface rate limit and payment errors so user knows what happened
         if (data?.error_code === 'rate_limited' || data?.error?.includes?.('429')) {
           toast.info('Auto-enrichment delayed — API is busy. Will retry on next visit.', { duration: 4000 });
         } else if (data?.error_code === 'payment_required') {
           toast.warning('Auto-enrichment skipped — AI credits depleted.', { duration: 6000 });
         }
       }
     } catch (error: any) {
       console.error('[AutoEnrich] Error:', error);
       // Surface rate limit and payment errors; stay silent on transient failures
       const msg = error?.message || '';
       if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
         toast.info('Auto-enrichment delayed — API is busy.', { duration: 4000 });
       } else if (msg.includes('402') || msg.toLowerCase().includes('credit')) {
         toast.warning('Auto-enrichment skipped — AI credits depleted.', { duration: 6000 });
       }
     } finally {
       setIsAutoEnriching(false);
     }
   };
 
   // Auto-trigger on mount/deal change (only once per deal)
   useEffect(() => {
     if (shouldEnrich && enabled && !hasTriggeredRef.current && deal?.id) {
       hasTriggeredRef.current = true;
       // Small delay to avoid blocking initial render
       const timer = setTimeout(() => {
         triggerEnrichment();
       }, 1000);
       
       return () => clearTimeout(timer);
     }
   }, [shouldEnrich, enabled, deal?.id]);
 
   // Reset trigger flag when deal changes
   useEffect(() => {
     hasTriggeredRef.current = false;
   }, [dealId]);
 
   return {
     isAutoEnriching,
     shouldAutoEnrich: shouldEnrich,
     enrichmentReason: reason,
     triggerEnrichment,
   };
 }