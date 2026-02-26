// ACTIVE — rendered at /admin/remarketing/deals/:dealId,
// /admin/remarketing/leads/captarget/:dealId, /admin/remarketing/leads/gp-partners/:dealId
// 4 tabs: Overview, Buyer Introductions, Contact History, Data Room
// CTO Audit February 2026
import { useState, useMemo, useEffect } from 'react';
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';
import { DealDataRoomTab } from './components/DealDataRoomTab';
import { DealOverviewTab } from './components/DealOverviewTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Building2,
  Check,
  ExternalLink,
  MapPin,
  Target,
  Pencil,
  Eye,
  X,
  FolderOpen,
  Handshake,
  Activity,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ScoreTierBadge,
  getTierFromScore,
  DealSourceBadge,
} from '@/components/remarketing';
import {
  DealBuyerHistoryTab,
  BuyerIntroductionTracker,
  ContactHistoryTracker,
} from '@/components/remarketing/deal-detail';
const ReMarketingDealDetail = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from || null;
  const queryClient = useQueryClient();
  const { setPageContext } = useAICommandCenterContext();

  useEffect(() => {
    if (dealId) {
      setPageContext({ page: 'deal_detail', entity_type: 'deal', entity_id: dealId });
    }
  }, [dealId, setPageContext]);

  // Fetch deal/listing data
  const { data: deal, isLoading: dealLoading } = useQuery({
    queryKey: ['remarketing', 'deal', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', dealId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });

  // Fetch score stats for this deal
  const { data: scoreStats } = useQuery({
    queryKey: ['remarketing', 'deal-scores', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('composite_score, status, tier')
        .eq('listing_id', dealId!);

      if (error) throw error;

      if (!data || data.length === 0) {
        return { count: 0, approved: 0, passed: 0, avgScore: 0 };
      }

      const approved = data.filter((s) => s.status === 'approved').length;
      const passed = data.filter((s) => s.status === 'passed').length;
      const avgScore = data.reduce((sum, s) => sum + (s.composite_score || 0), 0) / data.length;

      return { count: data.length, approved, passed, avgScore };
    },
    enabled: !!dealId,
  });

  // Fetch pipeline/outreach stats for this deal
  const { data: pipelineStats } = useQuery({
    queryKey: ['remarketing', 'pipeline', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_outreach')
        .select('status')
        .eq('listing_id', dealId!);

      if (error) throw error;

      return {
        contacted: data?.filter((o) => o.status === 'contacted').length || 0,
        responded: data?.filter((o) => o.status === 'responded').length || 0,
        meetingScheduled: data?.filter((o) => o.status === 'meeting_scheduled').length || 0,
        loiSent: data?.filter((o) => o.status === 'loi_sent').length || 0,
        closedWon: data?.filter((o) => o.status === 'closed_won').length || 0,
        closedLost: data?.filter((o) => o.status === 'closed_lost').length || 0,
      };
    },
    enabled: !!dealId,
  });

  // Fetch transcripts for this deal
  const { data: transcripts, isLoading: transcriptsLoading } = useQuery({
    queryKey: ['remarketing', 'deal-transcripts', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_transcripts')
        .select('*')
        .eq('listing_id', dealId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });

  // Derive all contact emails from deal + transcripts for multi-email Fireflies search
  const allContactEmails = useMemo(() => {
    const INTERNAL_DOMAINS = ['sourcecodeals.com', 'captarget.com'];
    const emailSet = new Set<string>();

    // Primary contact email
    if (deal?.main_contact_email) {
      emailSet.add(deal.main_contact_email.toLowerCase());
    }

    // Extract unique emails from transcript meeting_attendees that share the same domain
    const primaryDomain = deal?.main_contact_email?.split('@')[1]?.toLowerCase();

    if (transcripts && primaryDomain) {
      for (const t of transcripts) {
        const attendees = (t as any).meeting_attendees;
        if (Array.isArray(attendees)) {
          for (const email of attendees) {
            if (typeof email === 'string' && email.includes('@')) {
              const domain = email.split('@')[1]?.toLowerCase();
              // Include if same domain as primary contact and not internal
              if (domain === primaryDomain && !INTERNAL_DOMAINS.some((d) => domain === d)) {
                emailSet.add(email.toLowerCase());
              }
            }
          }
        }
      }
    }

    return Array.from(emailSet);
  }, [deal?.main_contact_email, transcripts]);

  // Extract website URL from internal_deal_memo_link
  const extractWebsiteFromMemo = (memoLink: string | null | undefined): string | null => {
    if (!memoLink) return null;

    // Skip SharePoint/OneDrive links
    if (memoLink.includes('sharepoint.com') || memoLink.includes('onedrive')) {
      return null;
    }

    // Handle "Website: https://..." format
    const websiteMatch = memoLink.match(/Website:\s*(https?:\/\/[^\s]+)/i);
    if (websiteMatch) return websiteMatch[1];

    // Handle direct URL (not SharePoint)
    if (memoLink.match(/^https?:\/\/[a-zA-Z0-9]/) && !memoLink.includes('sharepoint')) {
      return memoLink;
    }

    // Handle domain-only format (e.g., "pragra.io")
    if (memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) {
      return `https://${memoLink}`;
    }

    return null;
  };

  // Get effective website - prefer website field, fallback to extracted from memo
  const getEffectiveWebsite = (): string | null => {
    if (deal?.website) return deal.website;
    return extractWebsiteFromMemo(deal?.internal_deal_memo_link);
  };

  const effectiveWebsite = deal ? getEffectiveWebsite() : null;

  // Calculate data completeness
  const calculateDataCompleteness = () => {
    if (!deal) return 0;

    const fields = [
      deal.title,
      deal.description,
      deal.location,
      deal.revenue,
      deal.ebitda,
      deal.category,
      effectiveWebsite,
      deal.executive_summary,
      deal.service_mix,
      deal.geographic_states,
    ];

    const filledFields = fields.filter((f) => f !== null && f !== undefined && f !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const dataCompleteness = calculateDataCompleteness();

  // Inline editing state for company name (must be before early returns)
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const updateNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase
        .from('listings')
        .update({ internal_company_name: newName })
        .eq('id', dealId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
      toast.success('Company name updated');
      setIsEditingName(false);
    },
    onError: (err: Error) => {
      toast.error(`Failed to update name: ${err.message}`);
    },
  });

  const currentName = deal?.internal_company_name || deal?.title || '';

  const handleSaveName = () => {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === currentName) {
      setIsEditingName(false);
      return;
    }
    updateNameMutation.mutate(trimmed);
  };

  const handleCancelEdit = () => {
    setEditedName(currentName);
    setIsEditingName(false);
  };

  if (dealLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg">Deal not found</h3>
            <p className="text-muted-foreground">The deal you're looking for doesn't exist.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/deals')}>
              Back to Active Deals
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tier = scoreStats?.avgScore ? getTierFromScore(scoreStats.avgScore) : null;

  // Get display name - prefer internal_company_name, fallback to title
  const displayName = deal.internal_company_name || deal.title;
  const listedName =
    deal.internal_company_name && deal.title !== deal.internal_company_name ? deal.title : null;

  return (
    <div className="p-6 space-y-6">
      {/* CapTarget Info Section — shown only for captarget-sourced deals */}
      {deal.deal_source === 'captarget' && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="py-3">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
              <Target className="h-5 w-5" />
              CapTarget Info
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {deal.captarget_client_name && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Client
                  </p>
                  <p className="text-sm font-medium">{deal.captarget_client_name}</p>
                </div>
              )}
              {deal.captarget_contact_date && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Contact Date
                  </p>
                  <p className="text-sm">
                    {format(new Date(deal.captarget_contact_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {deal.captarget_outreach_channel && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Outreach Channel
                  </p>
                  <p className="text-sm">{deal.captarget_outreach_channel}</p>
                </div>
              )}
              {deal.captarget_interest_type && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Interest Type
                  </p>
                  <Badge
                    variant="outline"
                    className={
                      deal.captarget_interest_type === 'interest'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : deal.captarget_interest_type === 'no_interest'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : deal.captarget_interest_type === 'keep_in_mind'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                    }
                  >
                    {deal.captarget_interest_type === 'interest'
                      ? 'Interest'
                      : deal.captarget_interest_type === 'no_interest'
                        ? 'No Interest'
                        : deal.captarget_interest_type === 'keep_in_mind'
                          ? 'Keep in Mind'
                          : 'Unknown'}
                  </Badge>
                </div>
              )}
            </div>
            {/* Push status */}
            <div className="mt-3 flex items-center gap-4">
              {deal.pushed_to_all_deals ? (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200 gap-1"
                >
                  <Check className="h-3 w-3" />
                  Pushed to Active Deals
                  {deal.pushed_to_all_deals_at && (
                    <span className="text-green-500 ml-1">
                      {format(new Date(deal.pushed_to_all_deals_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={async () => {
                    const { error } = await supabase
                      .from('listings')
                      .update({
                        status: 'active',
                        remarketing_status: 'active',
                        pushed_to_all_deals: true,
                        pushed_to_all_deals_at: new Date().toISOString(),
                      })
                      .eq('id', dealId!);
                    if (error) {
                      toast.error('Failed to push deal');
                    } else {
                      toast.success('Deal pushed to Active Deals');
                      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
                      queryClient.invalidateQueries({
                        queryKey: ['remarketing', 'captarget-deals'],
                      });
                      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
                    }
                  }}
                >
                  Push to Active Deals
                </Button>
              )}
              {deal.captarget_source_url && (
                <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" asChild>
                  <a href={deal.captarget_source_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    View in Google Sheet
                  </a>
                </Button>
              )}
            </div>
            {/* Call notes collapsible */}
            {deal.captarget_call_notes && (
              <details className="mt-3">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                  Original Call Notes
                </summary>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap bg-white/60 rounded-md p-3 border">
                  {deal.captarget_call_notes}
                </p>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {backTo ? (
              <Button variant="ghost" size="sm" asChild>
                <Link to={backTo}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  className="text-2xl font-bold text-foreground bg-transparent border-b-2 border-primary outline-none px-0 py-0.5 min-w-[200px]"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  autoFocus
                  disabled={updateNameMutation.isPending}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleSaveName}
                  disabled={updateNameMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCancelEdit}
                  disabled={updateNameMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    setEditedName(displayName);
                    setIsEditingName(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {deal.category && <Badge variant="secondary">{deal.category}</Badge>}
            {/* Data Quality Badge with Rich Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant={dataCompleteness >= 80 ? 'default' : 'outline'}>
                    {dataCompleteness}% Data
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Deal Data Quality: {dataCompleteness}%</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((dataCompleteness / 100) * 10)} of 10 fields filled
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Seller Interest Score Badge */}
            {deal.seller_interest_score !== null && deal.seller_interest_score !== undefined && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={
                        deal.seller_interest_score >= 70
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : deal.seller_interest_score >= 40
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                      }
                    >
                      {deal.seller_interest_score} Seller Interest
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">
                      Seller Interest Score: {deal.seller_interest_score}/100
                    </p>
                    <p className="text-xs text-muted-foreground">
                      AI-analyzed from call transcripts and notes to indicate seller motivation
                      level.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Badge
              variant={deal.status === 'active' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {deal.status}
            </Badge>
            <DealSourceBadge source={deal.deal_source} />
          </div>
          {listedName && (
            <p className="text-sm text-muted-foreground mt-0.5">Listed as: {listedName}</p>
          )}
          {/* Show structured address if available, otherwise fall back to location */}
          {deal.address_city && deal.address_state ? (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              {deal.address_city}, {deal.address_state}
            </p>
          ) : deal.location ? (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              {deal.location}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {tier && <ScoreTierBadge tier={tier} size="lg" />}
        </div>
      </div>

      {/* ─── Tabbed Navigation ─── */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="text-sm">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="buyer-introductions" className="text-sm">
            <Handshake className="mr-1.5 h-3.5 w-3.5" />
            Buyer Introductions
          </TabsTrigger>
          <TabsTrigger value="contact-history" className="text-sm">
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Contact History
          </TabsTrigger>
          <TabsTrigger value="data-room" className="text-sm">
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Data Room
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ OVERVIEW TAB ════════════════ */}
        <TabsContent value="overview" className="space-y-6">
          <DealOverviewTab
            dealId={dealId!}
            deal={deal}
            scoreStats={scoreStats}
            pipelineStats={pipelineStats}
            transcripts={transcripts || []}
            transcriptsLoading={transcriptsLoading}
            allContactEmails={allContactEmails}
            effectiveWebsite={effectiveWebsite}
          />
        </TabsContent>

        {/* ════════════════ BUYER INTRODUCTIONS TAB ════════════════ */}
        <TabsContent value="buyer-introductions" className="space-y-6">
          {/* Introduction Tracker — tracks buyers who want to meet owner or have passed */}
          <BuyerIntroductionTracker
            listingId={dealId!}
            listingTitle={deal.internal_company_name || deal.title}
          />

          {/* Buyer Deal History — existing pipeline deals for this listing */}
          <DealBuyerHistoryTab
            listingId={dealId!}
            listingTitle={deal.internal_company_name || deal.title}
          />
        </TabsContent>

        {/* ════════════════ CONTACT HISTORY TAB ════════════════ */}
        <TabsContent value="contact-history" className="space-y-6">
          <ContactHistoryTracker
            listingId={dealId!}
            primaryContactEmail={deal.main_contact_email}
            primaryContactName={deal.main_contact_name}
          />
        </TabsContent>

        {/* ════════════════ DATA ROOM TAB ════════════════ */}
        <TabsContent value="data-room" className="space-y-6">
          <DealDataRoomTab dealId={dealId!} deal={deal} scoreStats={scoreStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReMarketingDealDetail;
