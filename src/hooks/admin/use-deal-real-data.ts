import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useDocumentLogs(dealId?: string) {
  return useQuery({
    queryKey: ['document-logs', dealId],
    queryFn: async () => {
      if (!dealId) return null;
      
      // Get both NDA and Fee Agreement logs
      const [ndaLogs, feeAgreementLogs] = await Promise.all([
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
        nda_logs: ndaLogs.data || [],
        fee_agreement_logs: feeAgreementLogs.data || []
      };
    },
    enabled: !!dealId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}


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
    staleTime: 5 * 60 * 1000,
  });
}


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
    staleTime: 5 * 60 * 1000,
  });
}


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
            linkedin_profile,
            geographic_focus,
            target_deal_size_min,
            target_deal_size_max,
            business_categories,
            fund_size,
            aum,
            bio,
            job_title,
            industry_expertise,
            is_funded,
            deployment_timing,
            funding_source
          )
        `)
        .eq('id', deal.connection_request_id)
        .single();

      if (requestError) throw requestError;
      
      // Handle the profiles relation correctly (it comes as an array or object)
      const profile = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
      
      // Structure the response to handle both registered users and leads
      return {
        ...request,
        // Determine if this is a registered user or lead
        isRegisteredUser: !!request.user_id,
        // Consolidated buyer info (prefer profile data, fallback to lead data)
        buyerInfo: profile ? {
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          company: profile.company,
          buyer_type: profile.buyer_type,
          phone_number: profile.phone_number,
          website: profile.website,
          linkedin_profile: profile.linkedin_profile,
          // Full profile data for investment details
          geographic_focus: profile.geographic_focus,
          target_deal_size_min: profile.target_deal_size_min,
          target_deal_size_max: profile.target_deal_size_max,
          business_categories: profile.business_categories,
          fund_size: profile.fund_size,
          aum: profile.aum,
          bio: profile.bio,
          job_title: profile.job_title,
          industry_expertise: profile.industry_expertise,
          is_funded: profile.is_funded,
          deployment_timing: profile.deployment_timing,
          funding_source: profile.funding_source
        } : {
          name: request.lead_name,
          first_name: request.lead_name?.split(' ')[0] || '',
          last_name: request.lead_name?.split(' ').slice(1).join(' ') || '',
          email: request.lead_email,
          company: request.lead_company,
          buyer_type: null,
          phone_number: request.lead_phone,
          website: null,
          linkedin_profile: null
        },
        // Always include the buyer message
        originalMessage: request.user_message
      };
    },
    enabled: !!dealId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRealDealAnalytics(dealId?: string) {
  return useQuery({
    queryKey: ['real-deal-analytics', dealId],
    queryFn: async () => {
      if (!dealId) return null;

      // Get deal, activities, and contacts in parallel
      const [dealResult, activitiesResult, contactsResult] = await Promise.all([
        supabase
          .from('deals')
          .select('*')
          .eq('id', dealId)
          .single(),
        supabase
          .from('deal_activities')
          .select('*')
          .eq('deal_id', dealId),
        supabase
          .from('deal_contacts')
          .select('*')
          .eq('deal_id', dealId)
      ]);

      if (dealResult.error) throw dealResult.error;
      
      const deal = dealResult.data;
      const activities = activitiesResult.data || [];
      const contacts = contactsResult.data || [];

      // Calculate days in current stage
      const stageEnteredAt = deal.stage_entered_at ? new Date(deal.stage_entered_at) : new Date(deal.created_at);
      const daysInStage = Math.floor((Date.now() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate total interactions
      const totalInteractions = activities.length + contacts.length;

      // Get last interaction date
      const allInteractionDates = [
        ...activities.map(a => new Date(a.created_at)),
        ...contacts.map(c => new Date(c.created_at))
      ].sort((a, b) => b.getTime() - a.getTime());
      
      const lastInteraction = allInteractionDates[0] || null;

      // Calculate document completion score
      let documentScore = 0;
      if (deal.nda_status === 'signed') documentScore += 50;
      else if (deal.nda_status === 'sent') documentScore += 25;
      
      if (deal.fee_agreement_status === 'signed') documentScore += 50;
      else if (deal.fee_agreement_status === 'sent') documentScore += 25;

      // Calculate risk assessment based on multiple factors
      let riskScore = 0;
      
      // Days without interaction
      const daysSinceLastInteraction = lastInteraction 
        ? Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24))
        : daysInStage;
      
      if (daysSinceLastInteraction > 14) riskScore += 30;
      else if (daysSinceLastInteraction > 7) riskScore += 15;
      
      // Time in stage without progress
      if (daysInStage > 30 && deal.stage_id) riskScore += 25;
      else if (daysInStage > 14 && deal.stage_id) riskScore += 10;
      
      // Document completion
      if (documentScore < 50) riskScore += 20;
      
      // Low interaction frequency
      if (totalInteractions < 3 && daysInStage > 7) riskScore += 15;

      return {
        daysInStage,
        totalInteractions,
        lastInteraction,
        daysSinceLastInteraction,
        documentCompletionScore: documentScore,
        riskAssessment: {
          score: Math.min(riskScore, 100),
          level: riskScore > 60 ? 'high' : riskScore > 30 ? 'medium' : 'low',
          factors: [
            ...(daysSinceLastInteraction > 14 ? ['No recent contact'] : []),
            ...(daysInStage > 30 ? ['Stuck in stage'] : []),
            ...(documentScore < 50 ? ['Incomplete documents'] : []),
            ...(totalInteractions < 3 ? ['Low engagement'] : [])
          ]
        }
      };
    },
    enabled: !!dealId,
    staleTime: 5 * 60 * 1000,
  });
}