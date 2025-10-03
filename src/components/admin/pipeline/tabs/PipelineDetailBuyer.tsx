import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ExternalLink, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getRelevantFieldsForBuyerType, FIELD_LABELS } from '@/lib/buyer-type-fields';
import { BUYER_TYPE_OPTIONS } from '@/lib/signup-field-options';
import { useAssociatedRequests } from '@/hooks/admin/use-associated-requests';

interface PipelineDetailBuyerProps {
  deal: Deal;
}

// Date safety helpers
const isValidDate = (value: any) => {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
};
const safeTimeAgo = (value: any, options?: Parameters<typeof formatDistanceToNow>[1]) => {
  return isValidDate(value)
    ? formatDistanceToNow(new Date(value), { addSuffix: true, ...(options || {}) })
    : 'Unknown';
};
export function PipelineDetailBuyer({ deal }: PipelineDetailBuyerProps) {
  // Phase 2: Resolve user_id from email (for both marketplace and lead-based deals)
  const { data: resolvedUserId } = useQuery({
    queryKey: ['resolved-user-id', deal.contact_email],
    queryFn: async () => {
      if (!deal.contact_email) return null;
      
      // Try to find user by email in profiles
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

  // Phase 2: Fetch ALL connection requests for this buyer (using OR logic for user_id and email)
  const { data: connectionRequests = [] } = useQuery({
    queryKey: ['buyer-connection-requests', deal.contact_email, resolvedUserId],
    queryFn: async () => {
      if (!deal.contact_email) return [];
      
      // Use resolved user_id OR email to match all connection requests
      const userId = buyerProfile?.user_id || resolvedUserId;
      
      let query = supabase
        .from('connection_requests')
        .select(`
          *,
          listings:listing_id(title, id, revenue, location, internal_company_name)
        `);
      
      // Build OR condition: match by user_id OR lead_email
      if (userId) {
        query = query.or(`user_id.eq.${userId},lead_email.eq.${deal.contact_email}`);
      } else {
        query = query.eq('lead_email', deal.contact_email);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!deal.contact_email,
    staleTime: 2 * 60 * 1000,
  });

  // Phase 2: Fetch saved listings using resolved user_id
  const { data: savedListings = [] } = useQuery({
    queryKey: ['buyer-saved-listings', resolvedUserId, buyerProfile?.user_id],
    queryFn: async () => {
      const userId = buyerProfile?.user_id || resolvedUserId;
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('saved_listings')
        .select(`
          *,
          listings:listing_id(title, id, revenue, location, internal_company_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!(buyerProfile?.user_id || resolvedUserId),
    staleTime: 5 * 60 * 1000,
  });

  // Phase 5: Fetch associated requests (company colleagues)
  const { data: associatedRequests = [] } = useAssociatedRequests(
    deal.connection_request_id
  );

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
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'object') {
      try {
        return Object.values(value).filter(Boolean).join(', ') || null;
      } catch {
        return String(value);
      }
    }
    
    return String(value);
  };

  const renderClickableLink = (text: string, url?: string, type: 'email' | 'website' | 'phone' = 'website') => {
    if (!url) return <span className="text-sm text-muted-foreground">{text}</span>;
    
    let href = url;
    if (type === 'email' && !url.startsWith('mailto:')) {
      href = `mailto:${url}`;
    } else if (type === 'phone' && !url.startsWith('tel:')) {
      href = `tel:${url}`;
    } else if (type === 'website' && !url.startsWith('http')) {
      href = `https://${url}`;
    }
    
    return (
      <a 
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
      >
        {text}
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  };

  const buyerPriority = getBuyerPriority(deal.buyer_type, deal.buyer_priority_score);
  // Type guard for profile access
  const profile = buyerProfile && 'profile' in buyerProfile ? buyerProfile.profile : null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 space-y-8 pb-8">
        {/* Primary Buyer Intelligence */}
        <div className="space-y-6">
          <div className="space-y-4">
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
                  {profile?.job_title && (
                    <p className="text-sm text-muted-foreground/70">{profile.job_title}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">
                    {getBuyerTypeLabel(deal.buyer_type || profile?.buyer_type)}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className={`text-xs font-mono ${buyerPriority.color}`}>
                    {buyerPriority.level} Priority ({buyerPriority.score})
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Contact Actions */}
            <div className="flex items-center gap-3 pt-2">
              {deal.contact_email && (
                <a 
                  href={`mailto:${deal.contact_email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Email
                </a>
              )}
              {deal.contact_phone && (
                <a 
                  href={`tel:${deal.contact_phone}`}
                  className="px-3 py-1.5 bg-muted text-foreground text-xs rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Call
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Comprehensive Profile Data in Collapsible Sections */}
        {profile && (
          <>
            {/* Contact & Basic Info */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h2 className="text-sm font-medium text-foreground">Contact & Basic Information</h2>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-foreground">Email</span>
                    {renderClickableLink(profile.email, profile.email, 'email')}
                  </div>
                  {profile.phone_number && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-foreground">Phone</span>
                      {renderClickableLink(profile.phone_number, profile.phone_number, 'phone')}
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-foreground">Website</span>
                      {renderClickableLink(profile.website, profile.website, 'website')}
                    </div>
                  )}
                  {profile.linkedin_profile && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-foreground">LinkedIn</span>
                      {renderClickableLink('View Profile', profile.linkedin_profile, 'website')}
                    </div>
                  )}
                  {profile.company && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-foreground">Company</span>
                      <span className="text-sm text-muted-foreground">{profile.company}</span>
                    </div>
                  )}
                  {profile.bio && (
                    <div className="py-2">
                      <span className="text-sm text-foreground block mb-2">Bio</span>
                      <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Investment Profile */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h2 className="text-sm font-medium text-foreground">Investment Profile</h2>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="space-y-3">
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
                  
                  {/* Business Categories */}
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
                  
                  {/* Geographic Focus */}
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

            {/* Buyer-Specific Details */}
            {profile.buyer_type && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <h2 className="text-sm font-medium text-foreground">
                    {getBuyerTypeLabel(profile.buyer_type)} Details
                  </h2>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="space-y-3">
                    {getRelevantFieldsForBuyerType(profile.buyer_type as any)
                      .filter(field => !['first_name', 'last_name', 'email', 'company', 'website', 'linkedin_profile', 'phone_number', 'bio', 'buyer_type', 'business_categories', 'target_locations', 'target_deal_size_min', 'target_deal_size_max', 'fund_size', 'aum', 'job_title'].includes(field))
                      .map(field => {
                        const value = formatFieldValue(field, (profile as any)[field]);
                        if (!value) return null;
                        
                        return (
                          <div key={field} className="flex items-center justify-between py-2">
                            <span className="text-sm text-foreground">
                              {FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            <span className="text-sm text-muted-foreground text-right max-w-[60%] break-words whitespace-normal overflow-hidden">
                              {value}
                            </span>
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}

        {/* Original Message */}
        {buyerProfile?.user_message && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <h2 className="text-sm font-medium text-foreground">Original Message</h2>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="py-4 px-5 bg-muted/20 rounded-xl">
                <p className="text-sm text-foreground leading-relaxed">{buyerProfile.user_message}</p>
                <p className="text-xs text-muted-foreground font-mono mt-3">
                  {safeTimeAgo(buyerProfile.created_at)}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Behavioral Intelligence - Tabbed Version */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <h2 className="text-sm font-medium text-foreground">Connection & Activity History</h2>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <Tabs defaultValue="direct" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="direct" className="text-xs">
                  Direct ({connectionRequests.length})
                </TabsTrigger>
                <TabsTrigger value="colleagues" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  Colleagues ({associatedRequests.length})
                </TabsTrigger>
                <TabsTrigger value="saved" className="text-xs">
                  Saved ({savedListings.length})
                </TabsTrigger>
              </TabsList>

              {/* Direct Connections Tab */}
              <TabsContent value="direct" className="mt-4 space-y-3">
                {connectionRequests.length > 0 ? (
                  <ScrollArea className="h-[300px] w-full rounded-lg border border-border/40">
                    <div className="space-y-1 p-2">
                      {connectionRequests.map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="text-sm text-foreground truncate">
                                {request.listings?.title || 'Unknown Listing'}
                                {request.listings?.internal_company_name && (
                                  <span className="text-muted-foreground">
                                    {' / '}
                                    <a
                                      href={`/listing/${request.listings.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-foreground hover:underline transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {request.listings.internal_company_name}
                                    </a>
                                  </span>
                                )}
                              </p>
                              {request.source === 'manual' && (
                                <Badge variant="outline" className="text-xs">Manual</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground font-mono">
                                {safeTimeAgo(request.created_at)}
                              </span>
                              {request.listings?.revenue && (
                                <>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    ${request.listings.revenue.toLocaleString()} revenue
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className={`w-2 h-2 rounded-full ml-3 flex-shrink-0 ${
                            request.status === 'approved' ? 'bg-emerald-500' :
                            request.status === 'rejected' ? 'bg-red-500' :
                            request.status === 'on_hold' ? 'bg-amber-500' :
                            'bg-muted-foreground/30'
                          }`} />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No direct connection requests
                  </div>
                )}
              </TabsContent>

              {/* Company Colleagues Tab */}
              <TabsContent value="colleagues" className="mt-4 space-y-3">
                {associatedRequests.length > 0 ? (
                  <ScrollArea className="h-[300px] w-full rounded-lg border border-border/40">
                    <div className="space-y-1 p-2">
                      {associatedRequests.map((assocReq) => (
                        <div key={assocReq.id} className="py-3 px-4 bg-muted/10 rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-sm font-medium text-foreground">
                                  {assocReq.lead_name || assocReq.user?.email || 'Unknown Contact'}
                                </p>
                                <Badge variant="secondary" className="text-xs">
                                  {assocReq.relationship_type === 'same_company' ? 'Same Company' : 'Related'}
                                </Badge>
                              </div>
                              {assocReq.lead_company && (
                                <p className="text-xs text-muted-foreground mb-2">
                                  {assocReq.lead_company}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm text-foreground truncate">
                                  {assocReq.listing?.title || 'Unknown Listing'}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {safeTimeAgo(assocReq.created_at)}
                                </span>
                                {assocReq.listing?.revenue && (
                                  <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      ${assocReq.listing.revenue.toLocaleString()} revenue
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className={`w-2 h-2 rounded-full ml-3 flex-shrink-0 ${
                              assocReq.status === 'approved' ? 'bg-emerald-500' :
                              assocReq.status === 'rejected' ? 'bg-red-500' :
                              assocReq.status === 'on_hold' ? 'bg-amber-500' :
                              'bg-muted-foreground/30'
                            }`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No associated requests from company colleagues
                  </div>
                )}
              </TabsContent>

              {/* Saved Listings Tab */}
              <TabsContent value="saved" className="mt-4 space-y-3">
                {savedListings.length > 0 ? (
                  <ScrollArea className="h-[300px] w-full rounded-lg border border-border/40">
                    <div className="space-y-1 p-2">
                      {savedListings.map((saved: any) => (
                        <div key={saved.id} className="flex items-center justify-between py-3 px-4 bg-muted/10 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">
                              {saved.listings?.title || 'Unknown Listing'}
                              {saved.listings?.internal_company_name && (
                                <span className="text-muted-foreground">
                                  {' / '}
                                  <a
                                    href={`/listing/${saved.listings.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground hover:underline transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {saved.listings.internal_company_name}
                                  </a>
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground font-mono">
                                {safeTimeAgo(saved.created_at)}
                              </span>
                              {saved.listings?.revenue && (
                                <>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    ${saved.listings.revenue.toLocaleString()} revenue
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No saved listings
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>

        {/* Deal Timeline */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <h2 className="text-sm font-medium text-foreground">Deal Timeline</h2>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground">Deal Created</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {safeTimeAgo(deal.deal_created_at)}
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
                  {safeTimeAgo(deal.deal_stage_entered_at, { addSuffix: false })}
                </span>
              </div>
              
              {profile?.onboarding_completed && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-foreground">Onboarding</span>
                  <span className="text-xs text-emerald-600 font-mono">Completed</span>
                </div>
              )}
              
              {profile?.nda_signed && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-foreground">NDA Status</span>
                  <span className="text-xs text-emerald-600 font-mono">Signed</span>
                </div>
              )}
              
              {profile?.fee_agreement_signed && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-foreground">Fee Agreement</span>
                  <span className="text-xs text-emerald-600 font-mono">Signed</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}