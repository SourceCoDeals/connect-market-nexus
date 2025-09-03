import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Real NDA and Fee Agreement logs
export function useDocumentLogs(dealId?: string) {
  return useQuery({
    queryKey: ['document-logs', dealId],
    queryFn: async () => {
      if (!dealId) return { nda_logs: [], fee_agreement_logs: [] };
      
      const [ndaResult, feeResult] = await Promise.all([
        supabase
          .from('nda_logs')
          .select('*')
          .eq('user_id', dealId)
          .order('created_at', { ascending: false }),
        supabase
          .from('fee_agreement_logs')
          .select('*')
          .eq('user_id', dealId)
          .order('created_at', { ascending: false })
      ]);

      return {
        nda_logs: ndaResult.data || [],
        fee_agreement_logs: feeResult.data || []
      };
    },
    enabled: !!dealId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Real deal activities and communications
export function useDealActivities(dealId?: string) {
  return useQuery({
    queryKey: ['deal-activities', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!dealId,
    staleTime: 30 * 1000,
  });
}

// Real deal contacts
export function useDealContacts(dealId?: string) {
  return useQuery({
    queryKey: ['deal-contacts', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('deal_contacts')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!dealId,
    staleTime: 30 * 1000,
  });
}

// Enhanced buyer profile with message from connection request
export function useBuyerProfile(dealId?: string) {
  return useQuery({
    queryKey: ['buyer-profile', dealId],
    queryFn: async () => {
      if (!dealId) return null;
      
      // Get the deal first to find the connection request
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select('connection_request_id')
        .eq('id', dealId)
        .single();

      if (dealError || !deal?.connection_request_id) return null;

      // Get the connection request with buyer message and full profile/lead data
      const { data: request, error: requestError } = await supabase
        .from('connection_requests')
        .select(`
          *,
          profiles!connection_requests_user_id_fkey(
            first_name,
            last_name,
            email,
            company,
            buyer_type,
            phone_number,
            website,
            linkedin_profile
          )
        `)
        .eq('id', deal.connection_request_id)
        .single();

      if (requestError) throw requestError;
      
      // Structure the response to handle both registered users and leads
      return {
        ...request,
        // Determine if this is a registered user or lead
        isRegisteredUser: !!request.user_id,
        // Consolidated buyer info (prefer profile data, fallback to lead data)
        buyerInfo: (request.profiles && Array.isArray(request.profiles) && request.profiles.length > 0) ? {
          name: `${request.profiles[0].first_name} ${request.profiles[0].last_name}`,
          email: request.profiles[0].email,
          company: request.profiles[0].company,
          buyer_type: request.profiles[0].buyer_type,
          phone_number: request.profiles[0].phone_number,
          website: request.profiles[0].website,
          linkedin_profile: request.profiles[0].linkedin_profile
        } : {
          name: request.lead_name,
          email: request.lead_email,
          company: request.lead_company,
          buyer_type: null,
          phone_number: request.lead_phone,
          website: null,
          linkedin_profile: null
        }
      };
    },
    enabled: !!dealId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Real deal analytics based on actual data
export function useRealDealAnalytics(dealId?: string) {
  return useQuery({
    queryKey: ['real-deal-analytics', dealId],
    queryFn: async () => {
      if (!dealId) return null;
      
      // Get deal with stage info
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select(`
          *,
          stage:deal_stages!deals_stage_id_fkey(name, color)
        `)
        .eq('id', dealId)
        .single();

      if (dealError || !deal) return null;

      // Calculate days in current stage
      const stageEnteredDate = new Date(deal.stage_entered_at || deal.created_at);
      const daysInStage = Math.floor((Date.now() - stageEnteredDate.getTime()) / (1000 * 60 * 60 * 24));

      // Get activity counts
      const { data: activities } = await supabase
        .from('deal_activities')
        .select('activity_type, created_at')
        .eq('deal_id', dealId);

      const { data: contacts } = await supabase
        .from('deal_contacts')
        .select('contact_type, created_at')
        .eq('deal_id', dealId);

      const totalInteractions = (activities?.length || 0) + (contacts?.length || 0);
      
      // Calculate last interaction
      const allInteractionDates = [
        ...(activities || []).map(a => new Date(a.created_at)),
        ...(contacts || []).map(c => new Date(c.created_at))
      ].sort((a, b) => b.getTime() - a.getTime());

      const lastInteractionDays = allInteractionDates.length > 0 
        ? Math.floor((Date.now() - allInteractionDates[0].getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Calculate document completion score
      let documentScore = 0;
      if (deal.nda_status === 'signed') documentScore += 50;
      else if (deal.nda_status === 'sent') documentScore += 25;
      
      if (deal.fee_agreement_status === 'signed') documentScore += 50;
      else if (deal.fee_agreement_status === 'sent') documentScore += 25;

      // Risk assessment based on real data
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (daysInStage > 14 && totalInteractions < 3) riskLevel = 'high';
      else if (daysInStage > 7 && totalInteractions < 2) riskLevel = 'medium';

      return {
        deal_id: dealId,
        days_in_current_stage: daysInStage,
        total_interactions: totalInteractions,
        last_interaction_days: lastInteractionDays,
        document_completion_score: documentScore,
        nda_status: deal.nda_status,
        fee_agreement_status: deal.fee_agreement_status,
        deal_value: deal.value || 0,
        probability: deal.probability || 50,
        risk_level: riskLevel,
        stage_name: deal.stage?.name || 'Unknown',
        stage_color: deal.stage?.color || '#3b82f6'
      };
    },
    enabled: !!dealId,
    staleTime: 60 * 1000, // 1 minute
  });
}