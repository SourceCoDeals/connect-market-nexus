import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
      <div className="p-8 space-y-8">
        {/* Buyer Profile Header */}
        <div className="space-y-6">
          <h4 className="font-semibold text-base tracking-tight">Buyer Profile</h4>
          
          <Card className="p-6">
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                    <span className="text-xl font-semibold text-primary">
                      {deal.contact_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UN'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">{deal.contact_name || 'Unknown Contact'}</h3>
                    {deal.contact_company && (
                      <p className="text-sm text-muted-foreground">{deal.contact_company}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-xs font-medium ${buyerPriority.bg} ${buyerPriority.color} border-0`}>
                        {getBuyerTypeLabel(deal.buyer_type)}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-border/60">
                        Priority: {buyerPriority.score}/100
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-2 gap-4">
                {deal.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{deal.contact_email}</span>
                  </div>
                )}
                {deal.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{deal.contact_phone}</span>
                  </div>
                )}
                {profile?.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{profile.website}</span>
                  </div>
                )}
                {profile?.linkedin_profile && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">LinkedIn Profile</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Original Connection Request Message */}
        {buyerProfile?.user_message && (
          <div className="space-y-4">
            <h4 className="font-semibold text-base tracking-tight">Original Message</h4>
            
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-1" />
                <div className="space-y-2">
                  <p className="text-sm text-foreground">{buyerProfile.user_message}</p>
                  <p className="text-xs text-muted-foreground">
                    Sent {formatDistanceToNow(new Date(buyerProfile.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Buyer Intelligence */}
        {profile && (
          <div className="space-y-6">
            <h4 className="font-semibold text-base tracking-tight">Buyer Intelligence</h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Investment Profile */}
              <Card className="p-6">
                <div className="space-y-4">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Investment Profile
                  </h5>
                  
                  <div className="space-y-3">
                    {profile.buyer_type && (
                      <div>
                        <p className="text-xs text-muted-foreground">Buyer Type</p>
                        <p className="text-sm font-medium">{getBuyerTypeLabel(profile.buyer_type)}</p>
                      </div>
                    )}
                    {profile.target_deal_size_min && profile.target_deal_size_max && (
                      <div>
                        <p className="text-xs text-muted-foreground">Deal Size Range</p>
                        <p className="text-sm font-medium">
                          ${profile.target_deal_size_min}M - ${profile.target_deal_size_max}M
                        </p>
                      </div>
                    )}
                    {profile.fund_size && (
                      <div>
                        <p className="text-xs text-muted-foreground">Fund Size</p>
                        <p className="text-sm font-medium">{profile.fund_size}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Background */}
              <Card className="p-6">
                <div className="space-y-4">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    Background
                  </h5>
                  
                  <div className="space-y-3">
                    {profile.job_title && (
                      <div>
                        <p className="text-xs text-muted-foreground">Title</p>
                        <p className="text-sm font-medium">{profile.job_title}</p>
                      </div>
                    )}
                    {profile.bio && (
                      <div>
                        <p className="text-xs text-muted-foreground">Bio</p>
                        <p className="text-sm">{profile.bio}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Connection History */}
        <div className="space-y-6">
          <h4 className="font-semibold text-base tracking-tight">Connection History</h4>
          
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">Previous Connections</h5>
                <Badge variant="outline" className="text-xs">
                  {connectionRequests.length} connection{connectionRequests.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              {connectionRequests.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No previous connection requests found
                </div>
              ) : (
                <div className="space-y-3">
                  {connectionRequests.slice(0, 5).map((request: any) => (
                    <div key={request.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{request.listings?.title || 'Unknown Listing'}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                          </p>
                          {request.listings?.asking_price && (
                            <p className="text-xs text-muted-foreground">
                              ${request.listings.asking_price.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-xs ${
                        request.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        request.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                        request.status === 'on_hold' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-muted border-border/60'
                      }`}>
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Saved Listings */}
        <div className="space-y-6">
          <h4 className="font-semibold text-base tracking-tight">Saved Listings</h4>
          
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">Favorites</h5>
                <Badge variant="outline" className="text-xs">
                  {savedListings.length} listing{savedListings.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              {savedListings.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No saved listings found
                </div>
              ) : (
                <div className="space-y-3">
                  {savedListings.slice(0, 5).map((saved: any) => (
                    <div key={saved.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{saved.listings?.title || 'Unknown Listing'}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-xs text-muted-foreground">
                            Saved {formatDistanceToNow(new Date(saved.created_at), { addSuffix: true })}
                          </p>
                          {saved.listings?.asking_price && (
                            <p className="text-xs text-muted-foreground">
                              ${saved.listings.asking_price.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Engagement Timeline */}
        <div className="space-y-6">
          <h4 className="font-semibold text-base tracking-tight">Buyer Journey</h4>
          
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Deal Created</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(deal.deal_created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Current Stage: {deal.stage_name}</p>
                  <p className="text-xs text-muted-foreground">
                    In stage for {formatDistanceToNow(new Date(deal.deal_stage_entered_at))}
                  </p>
                </div>
              </div>

              {deal.nda_status === 'signed' && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">NDA Signed</p>
                    <p className="text-xs text-muted-foreground">Document completed</p>
                  </div>
                </div>
              )}

              {deal.fee_agreement_status === 'signed' && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Fee Agreement Signed</p>
                    <p className="text-xs text-muted-foreground">Agreement executed</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}