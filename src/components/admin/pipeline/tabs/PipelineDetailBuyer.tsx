import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ExternalLink, Users, Mail, Phone, Globe } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getRelevantFieldsForBuyerType, FIELD_LABELS } from '@/lib/buyer-type-fields';
import { useAssociatedRequests } from '@/hooks/admin/use-associated-requests';
import { Label } from '@/components/ui/label';

interface PipelineDetailBuyerProps {
  deal: Deal;
}

// Date safety helpers
const isValidDate = (value: any) => {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
};

export function PipelineDetailBuyer({ deal }: PipelineDetailBuyerProps) {
  // Phase 2: Resolve user_id from email (for both marketplace and lead-based deals)
  const { data: resolvedUserId } = useQuery({
    queryKey: ['resolved-user-id', deal.contact_email],
    queryFn: async () => {
      if (!deal.contact_email) return null;
      
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', deal.contact_email)
        .maybeSingle();
      
      return userProfile?.id || null;
    },
    enabled: !!deal.contact_email,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch full buyer profile
  const { data: buyerProfile } = useQuery({
    queryKey: ['buyer-profile', deal.deal_id],
    queryFn: async () => {
      if (!deal.contact_email) return null;
      
      const { data: connectionRequest } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('lead_email', deal.contact_email)
        .limit(1)
        .single();
      
      if (!connectionRequest?.user_id) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', connectionRequest.user_id)
        .single();
      
      if (!profile) return connectionRequest;
      
      return { ...connectionRequest, profile };
    },
    enabled: !!deal.contact_email,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch connection requests
  const { data: connectionRequests = [] } = useQuery({
    queryKey: ['buyer-connection-requests', deal.contact_email, resolvedUserId],
    queryFn: async () => {
      if (!deal.contact_email) return [];
      
      const userId = buyerProfile?.user_id || resolvedUserId;
      
      let query = supabase
        .from('connection_requests')
        .select(`
          *,
          listings:listing_id(title, id, revenue, location, internal_company_name)
        `);
      
      if (userId) {
        query = query.or(`user_id.eq.${userId},lead_email.eq.${deal.contact_email}`);
      } else {
        query = query.eq('lead_email', deal.contact_email);
      }
      
      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!deal.contact_email,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch saved listings
  const { data: savedListings = [] } = useQuery({
    queryKey: ['buyer-saved-listings', resolvedUserId, buyerProfile?.user_id],
    queryFn: async () => {
      const userId = buyerProfile?.user_id || resolvedUserId;
      if (!userId) return [];
      
      const { data } = await supabase
        .from('saved_listings')
        .select(`
          *,
          listings:listing_id(title, id, revenue, location, internal_company_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false});
      
      return data || [];
    },
    enabled: !!(buyerProfile?.user_id || resolvedUserId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: associatedRequests = [] } = useAssociatedRequests(
    deal.connection_request_id,
    deal.contact_company || undefined,
    deal.contact_email || undefined
  );

  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity': return 'Private Equity';
      case 'familyOffice': return 'Family Office';
      case 'searchFund': return 'Search Fund';
      case 'corporate': return 'Corporate';
      case 'individual': return 'Individual';
      case 'independentSponsor': return 'Independent Sponsor';
      default: return 'Unknown';
    }
  };

  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', score: 95, color: 'text-emerald-600' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', score: 75, color: 'text-amber-600' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', score, color: 'text-emerald-600' };
        if (score && score >= 40) return { level: 'Medium', score, color: 'text-amber-600' };
        return { level: 'Standard', score: score || 25, color: 'text-muted-foreground' };
      default:
        return { level: 'Standard', score: 25, color: 'text-muted-foreground' };
    }
  };

  const formatFieldValue = (key: string, value: any) => {
    if (!value) return null;
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return value.join(', ');
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') {
      try {
        return Object.values(value).filter(Boolean).join(', ') || null;
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const buyerPriority = getBuyerPriority(deal.buyer_type, deal.buyer_priority_score);
  const profile = buyerProfile && 'profile' in buyerProfile ? buyerProfile.profile : null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex gap-6 px-6 py-6">
        {/* Left Column - Main Content */}
        <div className="flex-1 space-y-6 max-w-3xl">
          {/* Bio */}
          {profile?.bio && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Investment Profile */}
          {profile && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full group hover:text-foreground transition-colors">
                <h3 className="text-sm font-medium text-foreground">Investment Profile</h3>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="space-y-4">
                  {profile.target_deal_size_min && profile.target_deal_size_max && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-foreground">Deal Size Range</span>
                      <span className="text-sm text-muted-foreground font-mono">
                        ${profile.target_deal_size_min}M - ${profile.target_deal_size_max}M
                      </span>
                    </div>
                  )}
                  
                  {(profile.fund_size || profile.aum) && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-foreground">{profile.fund_size ? 'Fund Size' : 'AUM'}</span>
                      <span className="text-sm text-muted-foreground font-mono">
                        {profile.fund_size || profile.aum}
                      </span>
                    </div>
                  )}
                  
                  {profile.business_categories && Array.isArray(profile.business_categories) && profile.business_categories.length > 0 && (
                    <div className="py-2">
                      <span className="text-sm text-foreground block mb-2">Target Industries</span>
                      <div className="flex flex-wrap gap-1">
                        {profile.business_categories.map((category: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {profile.target_locations && Array.isArray(profile.target_locations) && profile.target_locations.length > 0 && (
                    <div className="py-2">
                      <span className="text-sm text-foreground block mb-2">Geographic Focus</span>
                      <div className="flex flex-wrap gap-1">
                        {profile.target_locations.map((location: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {location}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Connection History */}
          <Collapsible defaultOpen={connectionRequests.length > 0 && connectionRequests.length <= 5}>
            <CollapsibleTrigger className="flex items-center justify-between w-full group hover:text-foreground transition-colors">
              <h3 className="text-sm font-medium text-foreground">
                Connection History ({connectionRequests.length})
              </h3>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-2">
                {connectionRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No connection history</p>
                ) : (
                  connectionRequests.map((req: any) => (
                    <div key={req.id} className="p-3 border border-border/40 rounded-lg hover:border-border/60 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {req.listings?.internal_company_name || req.listings?.title || 'Unknown Listing'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {req.listings?.location && `${req.listings.location} · `}
                            {req.created_at && formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Badge variant={req.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                          {req.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Saved Listings */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full group hover:text-foreground transition-colors">
              <h3 className="text-sm font-medium text-foreground">
                Saved Listings ({savedListings.length})
              </h3>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-2">
                {savedListings.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No saved listings</p>
                ) : (
                  savedListings.map((saved: any) => (
                    <div key={saved.id} className="p-3 border border-border/40 rounded-lg">
                      <p className="text-sm font-medium text-foreground">
                        {saved.listings?.internal_company_name || saved.listings?.title || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {saved.listings?.location} · Saved {formatDistanceToNow(new Date(saved.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Associated Requests */}
          {associatedRequests.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full group hover:text-foreground transition-colors">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-foreground">
                    Company Colleagues ({associatedRequests.length})
                  </h3>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="space-y-2">
                  {associatedRequests.map((req: any) => (
                    <div key={req.id} className="p-3 border border-border/40 rounded-lg">
                      <p className="text-sm font-medium text-foreground">{req.lead_name || req.lead_email}</p>
                      <p className="text-xs text-muted-foreground">{req.lead_email}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Right Sidebar - Metadata */}
        <div className="w-80 flex-shrink-0 space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {deal.contact_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UN'}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-medium text-foreground">
                {deal.contact_name || 'Unknown Contact'}
              </h3>
              {deal.contact_company && (
                <p className="text-sm text-muted-foreground">{deal.contact_company}</p>
              )}
              {profile?.job_title && (
                <p className="text-sm text-muted-foreground">{profile.job_title}</p>
              )}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Quick Actions */}
          <div className="space-y-2">
            {deal.contact_email && (
              <a 
                href={`mailto:${deal.contact_email}`}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            )}
            {deal.contact_phone && (
              <a 
                href={`tel:${deal.contact_phone}`}
                className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground text-sm rounded-lg hover:bg-muted/80 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call
              </a>
            )}
            {profile?.website && (
              <a 
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground text-sm rounded-lg hover:bg-muted/80 transition-colors"
              >
                <Globe className="w-4 h-4" />
                Website
              </a>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Buyer Details */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Buyer Type</Label>
              <p className="text-sm text-foreground">
                {getBuyerTypeLabel(deal.buyer_type || profile?.buyer_type)}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Priority</Label>
              <p className={`text-sm font-medium ${buyerPriority.color}`}>
                {buyerPriority.level} ({buyerPriority.score})
              </p>
            </div>

            {profile?.email && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                <p className="text-sm text-foreground font-mono truncate">{profile.email}</p>
              </div>
            )}

            {profile?.phone_number && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Phone</Label>
                <p className="text-sm text-foreground font-mono">{profile.phone_number}</p>
              </div>
            )}

            {profile?.linkedin_profile && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">LinkedIn</Label>
                <a 
                  href={profile.linkedin_profile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                >
                  View Profile
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
