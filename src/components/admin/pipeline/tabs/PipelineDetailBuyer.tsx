import React from 'react';
import { Badge } from '@/components/ui/badge';

import { User, Building2, Mail, Phone, Calendar, Globe, MapPin, MessageSquare, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PipelineDetailBuyerProps {
  deal: Deal;
}

export function PipelineDetailBuyer({ deal }: PipelineDetailBuyerProps) {
  // Fetch full buyer profile via connection request
  const { data: buyerProfile } = useQuery({
    queryKey: ['buyer-profile', deal.deal_id],
    queryFn: async () => {
      if (!deal.contact_email) return null;
      
      // First get the connection request
      const { data: connectionRequest, error: connError } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('lead_email', deal.contact_email)
        .limit(1)
        .single();
      
      if (connError || !connectionRequest?.user_id) return null;

      // Then get the profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', connectionRequest.user_id)
        .single();
      
      if (profileError) return connectionRequest;
      
      return { ...connectionRequest, profile };
    },
    enabled: !!deal.contact_email,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch connection requests for this buyer
  const { data: connectionRequests = [] } = useQuery({
    queryKey: ['buyer-connection-requests', deal.contact_email],
    queryFn: async () => {
      if (!deal.contact_email) return [];
      
      const { data, error } = await supabase
        .from('connection_requests')
        .select(`
          *,
          listings:listing_id(title, id, asking_price, location)
        `)
        .eq('lead_email', deal.contact_email)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!deal.contact_email,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch saved listings for this buyer
  const { data: savedListings = [] } = useQuery({
    queryKey: ['buyer-saved-listings', buyerProfile?.user_id],
    queryFn: async () => {
      if (!buyerProfile?.user_id) return [];
      
      const { data, error } = await supabase
        .from('saved_listings')
        .select(`
          *,
          listings:listing_id(title, id, asking_price, location)
        `)
        .eq('user_id', buyerProfile.user_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!buyerProfile?.user_id,
    staleTime: 5 * 60 * 1000,
  });

  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity': return 'Private Equity';
      case 'familyOffice': return 'Family Office';
      case 'searchFund': return 'Search Fund';
      case 'corporate': return 'Corporate';
      case 'individual': return 'Individual';
      case 'independentSponsor': return 'Independent Sponsor';
      case 'advisor': return 'Advisor / Banker';
      case 'businessOwner': return 'Business Owner';
      default: return 'Unknown';
    }
  };

  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', score: 95, color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', score: 75, color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', score, color: 'text-emerald-600', bg: 'bg-emerald-50' };
        if (score && score >= 40) return { level: 'Medium', score, color: 'text-amber-600', bg: 'bg-amber-50' };
        return { level: 'Standard', score: score || 25, color: 'text-muted-foreground', bg: 'bg-muted/50' };
      default:
        return { level: 'Standard', score: 25, color: 'text-muted-foreground', bg: 'bg-muted/50' };
    }
  };

  const buyerPriority = getBuyerPriority(deal.buyer_type, deal.buyer_priority_score);
  // Type guard for profile access
  const profile = buyerProfile && 'profile' in buyerProfile ? buyerProfile.profile : null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 space-y-8 pb-8">
        {/* Buyer Profile - Apple Minimal */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foreground">Buyer Profile</h2>
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-primary">
                  {deal.contact_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UN'}
                </span>
              </div>
              <div className="space-y-3 flex-1 min-w-0">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-foreground">
                    {deal.contact_name || 'Unknown Contact'}
                  </h3>
                  {deal.contact_company && (
                    <p className="text-sm text-muted-foreground">{deal.contact_company}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">
                    {getBuyerTypeLabel(deal.buyer_type)}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    Score: {buyerPriority.score}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information - Clean Layout */}
          <div className="space-y-3">
            {deal.contact_email && (
              <div className="flex items-center gap-3 py-2">
                <span className="text-sm text-foreground w-16">Email</span>
                <span className="text-sm text-muted-foreground font-mono">{deal.contact_email}</span>
              </div>
            )}
            {deal.contact_phone && (
              <div className="flex items-center gap-3 py-2">
                <span className="text-sm text-foreground w-16">Phone</span>
                <span className="text-sm text-muted-foreground font-mono">{deal.contact_phone}</span>
              </div>
            )}
            {profile?.website && (
              <div className="flex items-center gap-3 py-2">
                <span className="text-sm text-foreground w-16">Website</span>
                <span className="text-sm text-muted-foreground">{profile.website}</span>
              </div>
            )}
            {profile?.linkedin_profile && (
              <div className="flex items-center gap-3 py-2">
                <span className="text-sm text-foreground w-16">LinkedIn</span>
                <span className="text-sm text-muted-foreground">Profile Available</span>
              </div>
            )}
          </div>
        </div>

        {/* Original Message - Clean Layout */}
        {buyerProfile?.user_message && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foreground">Original Message</h2>
            
            <div className="py-4 px-5 bg-muted/20 rounded-xl">
              <p className="text-sm text-foreground leading-relaxed">{buyerProfile.user_message}</p>
              <p className="text-xs text-muted-foreground font-mono mt-3">
                {formatDistanceToNow(new Date(buyerProfile.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        )}

        {/* Investment Intelligence - Apple Clean */}
        {profile && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foreground">Investment Profile</h2>
            
            <div className="space-y-4">
              {profile.buyer_type && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-foreground">Buyer Type</span>
                  <span className="text-sm text-muted-foreground font-mono">
                    {getBuyerTypeLabel(profile.buyer_type)}
                  </span>
                </div>
              )}
              
              {profile.target_deal_size_min && profile.target_deal_size_max && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-foreground">Deal Size</span>
                  <span className="text-sm text-muted-foreground font-mono">
                    ${profile.target_deal_size_min}M - ${profile.target_deal_size_max}M
                  </span>
                </div>
              )}
              
              {profile.fund_size && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-foreground">Fund Size</span>
                  <span className="text-sm text-muted-foreground font-mono">
                    {profile.fund_size}
                  </span>
                </div>
              )}
              
              {profile.job_title && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-foreground">Title</span>
                  <span className="text-sm text-muted-foreground">
                    {profile.job_title}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connection History - Simplified */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Connection History</h2>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground">Total Connections</span>
              <span className="text-sm text-muted-foreground font-mono">
                {connectionRequests.length}
              </span>
            </div>
            
            {connectionRequests.length > 0 && (
              <div className="space-y-1">
                {connectionRequests.slice(0, 3).map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {request.listings?.title || 'Unknown Listing'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </span>
                        {request.listings?.asking_price && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ${request.listings.asking_price.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ml-3 ${
                      request.status === 'approved' ? 'bg-emerald-500' :
                      request.status === 'rejected' ? 'bg-red-500' :
                      request.status === 'on_hold' ? 'bg-amber-500' :
                      'bg-muted-foreground/30'
                    }`} />
                  </div>
                ))}
                {connectionRequests.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    +{connectionRequests.length - 3} more connections
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Saved Listings - Minimal */}
        {savedListings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foreground">Saved Listings</h2>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground">Total Saved</span>
                <span className="text-sm text-muted-foreground font-mono">
                  {savedListings.length}
                </span>
              </div>
              
              <div className="space-y-1">
                {savedListings.slice(0, 3).map((saved: any) => (
                  <div key={saved.id} className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {saved.listings?.title || 'Unknown Listing'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDistanceToNow(new Date(saved.created_at), { addSuffix: true })}
                        </span>
                        {saved.listings?.asking_price && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ${saved.listings.asking_price.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {savedListings.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    +{savedListings.length - 3} more saved
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timeline - Apple Style */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Timeline</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground">Deal Created</span>
              <span className="text-xs text-muted-foreground font-mono">
                {formatDistanceToNow(new Date(deal.deal_created_at), { addSuffix: true })}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground">Current Stage</span>
              <span className="text-xs text-muted-foreground font-mono">
                {deal.stage_name}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground">In Stage For</span>
              <span className="text-xs text-muted-foreground font-mono">
                {formatDistanceToNow(new Date(deal.deal_stage_entered_at))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}