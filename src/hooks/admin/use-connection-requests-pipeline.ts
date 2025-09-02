import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useConnectionRequestStages, ConnectionRequestStage } from './use-connection-request-stages';

export interface ConnectionRequestPipeline {
  id: string;
  user_id: string | null;
  listing_id: string;
  status: string;
  buyer_priority_score: number;
  pipeline_stage_id: string | null;
  stage_entered_at: string;
  created_at: string;
  updated_at: string;
  user_message: string | null;
  decision_notes: string | null;
  
  // Buyer info
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_company: string | null;
  buyer_type: string | null;
  
  // Listing info  
  listing_title: string | null;
  listing_deal_identifier: string | null;
  listing_revenue: number | null;
  listing_ebitda: number | null;
  
  // Stage info
  stage_name: string | null;
  stage_color: string | null;
}

export function useConnectionRequestsPipeline() {
  const { data: stages, isLoading: stagesLoading } = useConnectionRequestStages();

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['connection-requests-pipeline'],
    queryFn: async () => {
      // First fetch connection requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('connection_requests')
        .select(`
          id,
          user_id,
          listing_id,
          status,
          buyer_priority_score,
          pipeline_stage_id,
          stage_entered_at,
          created_at,
          updated_at,
          user_message,
          decision_notes,
          lead_name,
          lead_email,
          lead_company
        `)
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('Error fetching connection requests:', requestsError);
        throw requestsError;
      }

      if (!requestsData || requestsData.length === 0) {
        return [];
      }

      // Batch fetch profiles and listings
      const userIds = requestsData.map(r => r.user_id).filter(Boolean);
      const listingIds = requestsData.map(r => r.listing_id).filter(Boolean);

      const [profilesResult, listingsResult] = await Promise.all([
        userIds.length > 0 ? supabase
          .from('profiles')
          .select('id, first_name, last_name, email, company, buyer_type')
          .in('id', userIds) : { data: [], error: null },
        listingIds.length > 0 ? supabase
          .from('listings')
          .select('id, title, deal_identifier, revenue, ebitda')
          .in('id', listingIds) : { data: [], error: null }
      ]);

      // Create type-safe maps
      const profilesMap = new Map<string, any>();
      const listingsMap = new Map<string, any>();
      
      profilesResult.data?.forEach(p => profilesMap.set(p.id, p));
      listingsResult.data?.forEach(l => listingsMap.set(l.id, l));

      return requestsData.map(request => {
        const profile = request.user_id ? profilesMap.get(request.user_id) : null;
        const listing = listingsMap.get(request.listing_id);

        return {
          ...request,
          buyer_name: request.lead_name || (profile ? 
            `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null),
          buyer_email: request.lead_email || profile?.email || null,
          buyer_company: request.lead_company || profile?.company || null,
          buyer_type: profile?.buyer_type || null,
          listing_title: listing?.title || null,
          listing_deal_identifier: listing?.deal_identifier || null,
          listing_revenue: listing?.revenue || null,
          listing_ebitda: listing?.ebitda || null,
          stage_name: null, // Will be populated by joining with stages
          stage_color: null, // Will be populated by joining with stages
        };
      }) as ConnectionRequestPipeline[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Group requests by stage and populate stage info
  const requestsByStage = React.useMemo(() => {
    if (!requests || !stages) return {};
    
    const stageMap = new Map(stages.map(s => [s.id, s]));
    
    return stages.reduce((acc, stage) => {
      acc[stage.id] = requests
        .filter(request => request.pipeline_stage_id === stage.id)
        .map(request => ({
          ...request,
          stage_name: stage.name,
          stage_color: stage.color,
        }));
      return acc;
    }, {} as Record<string, ConnectionRequestPipeline[]>);
  }, [requests, stages]);

  // Calculate metrics
  const metrics = React.useMemo(() => {
    if (!requests) {
      return {
        totalRequests: 0,
        highPriorityRequests: 0,
        avgDaysInStage: 0,
        conversionRate: 0,
      };
    }

    const totalRequests = requests.length;
    const highPriorityRequests = requests.filter(r => r.buyer_priority_score >= 4).length;
    
    const avgDaysInStage = requests.length > 0
      ? requests.reduce((sum, request) => {
          const stageEnteredAt = new Date(request.stage_entered_at);
          const now = new Date();
          const daysInStage = Math.floor((now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysInStage;
        }, 0) / requests.length
      : 0;

    const approvedRequests = requests.filter(r => r.status === 'approved').length;
    const conversionRate = totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0;

    return {
      totalRequests,
      highPriorityRequests,
      avgDaysInStage,
      conversionRate,
    };
  }, [requests]);

  return {
    requests: requests || [],
    stages: stages || [],
    requestsByStage,
    metrics,
    isLoading: requestsLoading || stagesLoading,
  };
}