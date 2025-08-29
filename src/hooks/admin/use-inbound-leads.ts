import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
const sb = supabase as any;
import { toast } from '@/hooks/use-toast';

export interface InboundLead {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  phone_number?: string;
  role?: string;
  message?: string;
  source: 'webflow' | 'manual' | 'referral' | 'cold_outreach' | 'networking' | 'linkedin' | 'email' | 'website';
  source_form_name?: string;
  mapped_to_listing_id?: string;
  mapped_to_listing_title?: string;
  mapped_at?: string;
  mapped_by?: string;
  converted_to_request_id?: string;
  converted_at?: string;
  status: 'pending' | 'mapped' | 'converted' | 'archived';
  priority_score: number;
  created_at: string;
  updated_at: string;
}

export interface CreateInboundLeadData {
  name: string;
  email: string;
  company_name?: string;
  phone_number?: string;
  role?: string;
  message?: string;
  source: 'webflow' | 'manual' | 'referral' | 'cold_outreach' | 'networking' | 'linkedin' | 'email' | 'website';
  source_form_name?: string;
}

export interface MapLeadToListingData {
  leadId: string;
  listingId: string;
  listingTitle: string;
}

export interface DuplicateCheckResult {
  exactDuplicate?: {
    requestId: string;
    userEmail: string;
  };
  sameFirmRequests?: Array<{
    requestId: string;
    userEmail: string;
    companyName: string;
  }>;
  hasDuplicates: boolean;
}

// Query hook for fetching inbound leads
export function useInboundLeadsQuery() {
  return useQuery<InboundLead[]>({
    queryKey: ['inbound-leads'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('inbound_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InboundLead[];
    },
  });
}

// Helper function to normalize company names for matching
const normalizeCompanyName = (companyName?: string): string => {
  if (!companyName) return '';
  return companyName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|corp|ltd|limited|company|co\.?)\b/g, '')
    .trim();
};

// Helper function to extract domain from email
const getEmailDomain = (email: string): string => {
  return email.split('@')[1] || '';
};

// Enhanced scoring function
const calculateLeadScore = (lead: Partial<CreateInboundLeadData>): number => {
  let score = 0;
  
  // Role-based scoring (higher weight for PE/FO/Corp)
  const roleScores: Record<string, number> = {
    'private equity': 50,
    'family office': 50,
    'corporate': 45,
    'independent sponsor': 40,
    'search fund': 35,
    'individual': 20,
  };
  
  if (lead.role) {
    const normalizedRole = lead.role.toLowerCase();
    for (const [role, points] of Object.entries(roleScores)) {
      if (normalizedRole.includes(role)) {
        score += points;
        break;
      }
    }
  }
  
  // Email domain scoring (corporate domains get bonus)
  if (lead.email) {
    const domain = getEmailDomain(lead.email);
    const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
    if (!freeDomains.includes(domain)) {
      score += 15; // Corporate email bonus
    }
  }
  
  // Message quality scoring
  if (lead.message) {
    const messageLength = lead.message.length;
    if (messageLength > 100) score += 10;
    if (messageLength > 200) score += 5;
    
    // Bonus for professional keywords
    const professionalKeywords = ['acquisition', 'investment', 'portfolio', 'strategic', 'ebitda', 'revenue', 'valuation'];
    const messageWords = lead.message.toLowerCase();
    professionalKeywords.forEach(keyword => {
      if (messageWords.includes(keyword)) score += 3;
    });
  }
  
  // Company name bonus
  if (lead.company_name && lead.company_name.trim()) {
    score += 10;
  }
  
  return Math.min(score, 100); // Cap at 100
};

// Query hook for checking duplicates when mapping
export function useCheckDuplicates() {
  return async (leadEmail: string, leadCompany: string, listingId: string): Promise<DuplicateCheckResult> => {
    try {
      const { data: existingRequests, error } = await sb
        .from('connection_requests')
        .select(`
          id,
          user_id,
          profiles!inner(email, company)
        `)
        .eq('listing_id', listingId);

      if (error) throw error;

      const normalizedLeadCompany = normalizeCompanyName(leadCompany);
      const leadDomain = getEmailDomain(leadEmail);
      
      let exactDuplicate;
      const sameFirmRequests = [];

      for (const request of existingRequests || []) {
        const profile = (request as any).profiles;
        
        // Check for exact email match (case-insensitive)
        if (profile.email && profile.email.toLowerCase() === leadEmail.toLowerCase()) {
          exactDuplicate = {
            requestId: request.id,
            userEmail: profile.email
          };
          continue;
        }
        
        // Check for same company/domain
        const normalizedExistingCompany = normalizeCompanyName(profile.company);
        const existingDomain = getEmailDomain(profile.email);
        
        const isSameFirm = (
          (normalizedLeadCompany && normalizedExistingCompany && normalizedLeadCompany === normalizedExistingCompany) ||
          (leadDomain && existingDomain && leadDomain === existingDomain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(leadDomain))
        );
        
        if (isSameFirm) {
          sameFirmRequests.push({
            requestId: request.id,
            userEmail: profile.email,
            companyName: profile.company || 'Unknown'
          });
        }
      }

      return {
        exactDuplicate,
        sameFirmRequests,
        hasDuplicates: !!exactDuplicate || sameFirmRequests.length > 0
      };
      
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return { hasDuplicates: false };
    }
  };
}

// Mutation hook for creating inbound leads with enhanced scoring
export function useCreateInboundLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadData: CreateInboundLeadData) => {
      // Calculate enhanced priority score
      const priority_score = calculateLeadScore(leadData);
      
      const { data, error } = await sb
        .from('inbound_leads')
        .insert([{ ...leadData, priority_score }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      toast({
        title: "Lead created",
        description: "Inbound lead has been successfully created",
      });
    },
    onError: (error) => {
      console.error('Error creating inbound lead:', error);
      toast({
        variant: "destructive",
        title: "Failed to create lead",
        description: "Could not create the inbound lead",
      });
    },
  });
}

// Mutation hook for mapping lead to listing with duplicate checking
export function useMapLeadToListing() {
  const queryClient = useQueryClient();
  const checkDuplicates = useCheckDuplicates();

  return useMutation({
    mutationFn: async ({ leadId, listingId, listingTitle, skipDuplicateCheck = false }: MapLeadToListingData & { skipDuplicateCheck?: boolean }) => {
      // Get current admin user ID
      const { data: { user }, error: authError } = await sb.auth.getUser();
      if (authError || !user) throw new Error('Authentication required');

      // Get lead data for duplicate checking
      if (!skipDuplicateCheck) {
        const { data: leadData, error: leadError } = await sb
          .from('inbound_leads')
          .select('email, company_name')
          .eq('id', leadId)
          .single();
          
        if (leadError) throw leadError;
        
        const duplicateResult = await checkDuplicates(leadData.email, leadData.company_name || '', listingId);
        
        if (duplicateResult.hasDuplicates) {
          // Return the duplicate result for UI handling
          throw { isDuplicateError: true, duplicateResult, leadData };
        }
      }

      const { data, error } = await sb
        .from('inbound_leads')
        .update({
          mapped_to_listing_id: listingId,
          mapped_to_listing_title: listingTitle,
          mapped_at: new Date().toISOString(),
          mapped_by: user.id,
          status: 'mapped',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      toast({
        title: "Lead mapped",
        description: "Lead has been successfully mapped to listing",
      });
    },
    onError: (error) => {
      console.error('Error mapping lead to listing:', error);
      toast({
        variant: "destructive",
        title: "Failed to map lead",
        description: "Could not map the lead to listing",
      });
    },
  });
}

// Mutation hook for converting lead to connection request
// Mutation hook for converting lead to connection request
export function useConvertLeadToRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string) => {
      console.group('[ConvertLeadToRequest] Start');
      console.debug('[ConvertLeadToRequest] leadId:', leadId);

      // Fetch lead
      const { data: lead, error: leadError } = await sb
        .from('inbound_leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();

      if (leadError || !lead) {
        console.error('[ConvertLeadToRequest] Lead fetch error:', leadError);
        throw leadError || new Error('Lead not found');
      }

      if (!lead.mapped_to_listing_id) {
        console.warn('[ConvertLeadToRequest] Lead not mapped to listing');
        throw new Error('Lead must be mapped to a listing before conversion');
      }

      // Get admin user
      const { data: { user: adminUser }, error: adminAuthError } = await sb.auth.getUser();
      if (adminAuthError || !adminUser) {
        console.error('[ConvertLeadToRequest] Auth error:', adminAuthError);
        throw new Error('Authentication required for conversion');
      }

      // Check for existing user and existing requests for this listing/email combo (case-insensitive)
      const { data: existingProfile, error: profileErr } = await sb
        .from('profiles')
        .select('id, email')
        .ilike('email', lead.email)
        .maybeSingle();

      if (profileErr) {
        console.error('[ConvertLeadToRequest] Profile lookup error:', profileErr);
        throw profileErr;
      }

      // Check for existing requests by user_id or lead_email
      let existingRequestId: string | null = null;

      if (existingProfile?.id) {
        const { data: dupByUser, error: dupByUserErr } = await sb
          .from('connection_requests')
          .select('id')
          .eq('listing_id', lead.mapped_to_listing_id)
          .eq('user_id', existingProfile.id)
          .limit(1)
          .maybeSingle();
        if (dupByUserErr) {
          console.error('[ConvertLeadToRequest] Duplicate check (by user) error:', dupByUserErr);
        }
        existingRequestId = dupByUser?.id || null;
      }

      // Also check for lead-only requests with the same email
      if (!existingRequestId) {
        const { data: dupByEmail, error: dupByEmailErr } = await sb
          .from('connection_requests')
          .select('id')
          .eq('listing_id', lead.mapped_to_listing_id)
          .ilike('lead_email', lead.email)
          .limit(1)
          .maybeSingle();
        if (dupByEmailErr) {
          console.error('[ConvertLeadToRequest] Duplicate check (by lead email) error:', dupByEmailErr);
        }
        existingRequestId = dupByEmail?.id || null;
      }

      if (existingRequestId) {
        console.warn('[ConvertLeadToRequest] Duplicate request found:', existingRequestId);
        throw new Error(`Duplicate connection request found. A request already exists for this email and listing combination (Request ID: ${existingRequestId}). Cannot create duplicate requests.`);
      }

      // Create connection request - either user-linked or lead-only
      let resolvedUserId: string | null = null;
      let isLeadOnlyRequest = false;

      if (existingProfile?.id) {
        resolvedUserId = existingProfile.id;
        console.info('[ConvertLeadToRequest] Matched existing user profile for email', lead.email, '->', resolvedUserId);
      } else {
        // NEW APPROACH: Create lead-only request instead of auto-creating users
        console.info('[ConvertLeadToRequest] Creating lead-only request for:', lead.email);
        isLeadOnlyRequest = true;
      }

      // Prepare request data based on whether we have a user or not
      const sourceValue = lead.source || 'manual';
      const requestData: any = {
        listing_id: lead.mapped_to_listing_id,
        user_message: lead.message || 'Converted from inbound lead',
        status: 'pending',
        source: sourceValue,
        source_lead_id: leadId,
        source_metadata: {
          lead_name: lead.name,
          lead_email: lead.email,
          lead_company: lead.company_name,
          lead_phone: lead.phone_number,
          lead_role: lead.role,
          original_message: lead.message,
          priority_score: lead.priority_score,
          form_name: lead.source_form_name,
          converted_from_lead: true,
          is_lead_only_request: isLeadOnlyRequest,
        },
        converted_by: adminUser.id,
        converted_at: new Date().toISOString(),
      };

      // Add user_id if user exists, otherwise add lead info for lead-only request
      if (resolvedUserId) {
        requestData.user_id = resolvedUserId;
      } else {
        requestData.lead_email = lead.email;
        requestData.lead_name = lead.name;
        requestData.lead_company = lead.company_name;
        requestData.lead_role = lead.role;
        requestData.lead_phone = lead.phone_number;
      }

      const { data: connectionRequest, error: requestError } = await sb
        .from('connection_requests')
        .insert([requestData])
        .select('id')
        .single();

      if (requestError) {
        console.error('[ConvertLeadToRequest] Request insert error:', requestError);
        throw requestError;
      }

      // Update lead status
      const { error: updateError } = await sb
        .from('inbound_leads')
        .update({
          converted_to_request_id: connectionRequest.id,
          converted_at: new Date().toISOString(),
          status: 'converted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (updateError) {
        console.error('[ConvertLeadToRequest] Lead update error:', updateError);
        throw updateError;
      }

      console.groupEnd();
      return connectionRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: 'Lead converted',
        description: 'Lead has been successfully converted to a connection request',
      });
    },
    onError: (error) => {
      console.error('[ConvertLeadToRequest] Error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to convert lead',
        description: (error as any)?.message || 'Could not convert the lead to connection request',
      });
    },
  });
}

// Mutation hook for archiving leads
export function useArchiveInboundLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await sb
        .from('inbound_leads')
        .update({
          status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      toast({
        title: "Lead archived",
        description: "Lead has been archived",
      });
    },
    onError: (error) => {
      console.error('Error archiving lead:', error);
      toast({
        variant: "destructive",
        title: "Failed to archive lead",
        description: "Could not archive the lead",
      });
    },
  });
}