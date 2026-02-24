import { useState, useMemo } from "react";
import { BuyerDealHistoryPanel } from "@/components/admin/data-room/BuyerDealHistoryPanel";
import { ExtractionSummaryDialog } from "@/components/remarketing/buyer-detail/ExtractionSummaryDialog";
import { BuyerNotesSection } from "@/components/remarketing/buyer-detail/BuyerNotesSection";
import { ContactCallTimeline } from "@/components/remarketing/buyer-detail/ContactCallTimeline";
import { FirefliesTranscriptSearch } from "@/components/buyers/FirefliesTranscriptSearch";
import { BuyerEngagementTab } from "@/components/remarketing/buyer-detail/BuyerEngagementTab";
import { BuyerContactsHub } from "@/components/remarketing/buyer-detail/BuyerContactsHub";
import { BuyerAgreementsRebuild } from "@/components/remarketing/buyer-detail/BuyerAgreementsRebuild";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Users,
  Phone,
  BarChart2,
  FileSignature,
  FolderOpen,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import {
  BuyerDetailHeader,
  CriteriaCompletenessBanner,
  MainContactCard,
  BusinessDescriptionCard,
  InvestmentCriteriaCard,
  GeographicFootprintCard,
  DealStructureCard,
  CustomerEndMarketCard,
  AcquisitionHistoryCard,
  TranscriptsListCard,
  EditBusinessDescriptionDialog,
  EditInvestmentCriteriaDialog,
  EditDealStructureDialog,
  EditGeographicFootprintDialog,
  EditCustomerInfoDialog,
  EditAcquisitionHistoryDialog,
  BuyerCompanyOverviewCard,
  BuyerServicesBusinessModelCard,
  EditBuyerCompanyOverviewDialog,
  EditBuyerServicesBusinessModelDialog,
} from "@/components/remarketing/buyer-detail";

interface BuyerData {
  id: string;
  company_name: string;
  company_website: string | null;
  buyer_type: string | null;
  universe_id: string | null;
  thesis_summary: string | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_ebitda_min: number | null;
  target_ebitda_max: number | null;
  target_geographies: string[] | null;
  target_services: string[] | null;
  geographic_footprint: string[] | null;
  notes: string | null;
  data_last_updated: string | null;
  pe_firm_name: string | null;
  pe_firm_website: string | null;
  platform_website: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  has_fee_agreement: boolean | null;
  email_domain: string | null;
  marketplace_firm_id?: string | null;
  fee_agreement_source?: string | null;
  industry_vertical: string | null;
  business_summary: string | null;
  acquisition_appetite: string | null;
  acquisition_timeline: string | null;
  total_acquisitions: number | null;
  acquisition_frequency: string | null;
  primary_customer_size: string | null;
  customer_geographic_reach: string | null;
  customer_industries: string[] | null;
  target_customer_profile: string | null;
  investment_date: string | null;
  founded_year?: number | null;
  num_employees?: number | null;
  number_of_locations?: number | null;
  operating_locations?: string[] | null;
  service_regions?: string[] | null;
  services_offered?: string | null;
  business_type?: string | null;
  revenue_model?: string | null;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  linkedin_url: string | null;
  company_type: string | null;
  is_primary: boolean | null;
}

interface Transcript {
  id: string;
  transcript_text: string;
  source: string | null;
  file_name: string | null;
  file_url: string | null;
  processed_at: string | null;
  extracted_data: Record<string, unknown> | null;
  created_at: string;
}

type EditDialogType = 'business' | 'investment' | 'dealStructure' | 'geographic' | 'customer' | 'acquisition' | 'companyOverview' | 'servicesModel' | null;

const ReMarketingBuyerDetail = () => {
  const { id } = useParams<{ id: string }>();
  useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const backTo = (location.state as { from?: string } | null)?.from || "/admin/buyers";
  const isNew = id === 'new';

  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [activeEditDialog, setActiveEditDialog] = useState<EditDialogType>(null);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    linkedin_url: '',
    is_primary: false,
  });

  // Fetch buyer data
  const { data: buyer, isLoading } = useQuery({
    queryKey: ['remarketing', 'buyer', id],
    queryFn: async () => {
      if (isNew) return null;
      
      const { data, error } = await supabase
        .from('remarketing_buyers')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      return data as unknown as BuyerData;
    },
    enabled: !isNew
  });

  // Look up the PE firm record by name (for clickable PE firm link)
  const { data: peFirmRecord } = useQuery({
    queryKey: ['remarketing', 'pe-firm-lookup', buyer?.pe_firm_name],
    queryFn: async () => {
      if (!buyer?.pe_firm_name) return null;
      const { data, error } = await supabase
        .from('remarketing_buyers')
        .select('id, company_name')
        .eq('company_name', buyer.pe_firm_name)
        .eq('buyer_type', 'pe_firm')
        .eq('archived', false)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!buyer?.pe_firm_name,
  });

  // Fetch contacts from unified contacts table
  const { data: contacts = [] } = useQuery({
    queryKey: ['remarketing', 'contacts', id],
    queryFn: async () => {
      if (isNew) return [];

      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, linkedin_url, title, is_primary_at_firm')
        .eq('remarketing_buyer_id', id!)
        .eq('contact_type', 'buyer')
        .eq('archived', false)
        .order('is_primary_at_firm', { ascending: false });

      if (error) throw error;
      return (data || []).map((c) => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
        email: c.email,
        phone: c.phone,
        role: c.title,
        linkedin_url: c.linkedin_url,
        company_type: null,
        is_primary: c.is_primary_at_firm,
      })) as Contact[];
    },
    enabled: !isNew
  });

  // Fetch transcripts - using backwards-compatible view
  const { data: transcripts = [] } = useQuery({
    queryKey: ['remarketing', 'transcripts', id],
    queryFn: async () => {
      if (isNew) return [];
      
      // Use existing buyer_transcripts table (unified migration not executed yet)
      const { data, error } = await supabase
        .from('buyer_transcripts')
        .select('*')
        .eq('buyer_id', id!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Transcript[];
    },
    enabled: !isNew
  });

  // Recent scores query removed - now handled by BuyerEngagementTab

  // Calculate data completeness percentage
  const dataCompleteness = useMemo(() => {
    if (!buyer) return 0;
    
    const fields = [
      buyer.company_name,
      buyer.company_website,
      buyer.pe_firm_name,
      buyer.thesis_summary,
      buyer.target_revenue_min,
      buyer.target_revenue_max,
      buyer.target_geographies?.length,
      buyer.target_services?.length,
      buyer.business_summary,
      buyer.industry_vertical,
      buyer.acquisition_appetite,
    ];
    
    const filledCount = fields.filter(Boolean).length;
    return Math.round((filledCount / fields.length) * 100);
  }, [buyer]);

  // Calculate missing fields
  const missingFields = useMemo(() => {
    if (!buyer) return [];
    const missing: string[] = [];
    
    if (!buyer.target_geographies?.length) missing.push("geography preferences");
    if (!buyer.target_revenue_min && !buyer.target_revenue_max) missing.push("size criteria");
    if (!buyer.target_services?.length) missing.push("target services");
    if (!buyer.thesis_summary) missing.push("investment thesis");
    if (!buyer.business_summary) missing.push("business summary");
    
    return missing;
  }, [buyer]);

  // Mutations
  const enrichMutation = useMutation({
    mutationFn: async () => {
      const { queueBuyerEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueBuyerEnrichment([id!]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', id] });
      toast.success('Buyer enriched successfully');
    },
    onError: (error: Error) => {
      toast.error(`Enrichment failed: ${error.message}`);
    }
  });

  const updateBuyerMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { error } = await supabase
        .from('remarketing_buyers')
        .update(data)
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', id] });
      toast.success('Buyer updated');
      setActiveEditDialog(null);
    },
    onError: () => {
      toast.error('Failed to update buyer');
    }
  });

  const updateFeeAgreementMutation = useMutation({
    mutationFn: async (hasFeeAgreement: boolean) => {
      if (!buyer) throw new Error('No buyer data');

      if (hasFeeAgreement) {
        // TURNING ON: Sync to marketplace firm_agreements
        let firmId = buyer.marketplace_firm_id;

        if (!firmId) {
          const firmName = buyer.pe_firm_name || buyer.company_name;
          const firmWebsite = buyer.pe_firm_website || buyer.company_website;

          if (firmName) {
            const { data: createdFirmId, error: createdFirmIdError } = await supabase.rpc('get_or_create_firm', {
              p_company_name: firmName,
              p_website: firmWebsite ?? undefined,
              p_email: undefined,
            });
            if (createdFirmIdError) throw createdFirmIdError;

            if (createdFirmId) {
              firmId = createdFirmId;
              await supabase
                .from('remarketing_buyers')
                .update({ marketplace_firm_id: firmId })
                .eq('id', id!);
            }
          }
        }

        if (firmId) {
          await supabase.rpc('update_fee_agreement_firm_status', {
            p_firm_id: firmId,
            p_is_signed: true,
            p_signed_by_user_id: undefined,
            p_signed_at: new Date().toISOString(),
          });
        }

        const { error } = await supabase
          .from('remarketing_buyers')
          .update({
            has_fee_agreement: true,
            fee_agreement_source: firmId ? 'marketplace_synced' : 'manual_override',
          })
          .eq('id', id!);
        if (error) throw error;
      } else {
        // TURNING OFF: Only remove manual overrides
        if (buyer.fee_agreement_source === 'marketplace_synced' || buyer.fee_agreement_source === 'pe_firm_inherited') {
          throw new Error('This fee agreement comes from the marketplace. Remove it from Firm Agreements instead.');
        }

        const { error } = await supabase
          .from('remarketing_buyers')
          .update({
            has_fee_agreement: false,
            fee_agreement_source: null,
          })
          .eq('id', id!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', id] });
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      toast.success('Fee agreement updated — synced to marketplace');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update fee agreement');
    }
  });

  const addContactMutation = useMutation({
    mutationFn: async () => {
      const nameParts = newContact.name.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { error } = await supabase
        .from('contacts')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          email: newContact.email || null,
          phone: newContact.phone || null,
          title: newContact.role || null,
          linkedin_url: newContact.linkedin_url || null,
          is_primary_at_firm: newContact.is_primary,
          contact_type: 'buyer' as const,
          remarketing_buyer_id: id!,
          firm_id: buyer?.marketplace_firm_id ?? null,
          source: 'remarketing_manual',
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'contacts', id] });
      toast.success('Contact added');
      setIsContactDialogOpen(false);
      setNewContact({ name: '', email: '', phone: '', role: '', linkedin_url: '', is_primary: false });
    },
    onError: () => {
      toast.error('Failed to add contact');
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'contacts', id] });
      toast.success('Contact deleted');
    },
    onError: () => {
      toast.error('Failed to delete contact');
    }
  });

  const addTranscriptMutation = useMutation({
    mutationFn: async ({
      text,
      source,
      fileName,
      fileUrl,
      triggerExtract,
    }: {
      text: string;
      source: string;
      fileName?: string;
      fileUrl?: string;
      triggerExtract?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('buyer_transcripts')
        .insert([
          {
            buyer_id: id!,
            title: fileName || 'Manual Transcript',
            transcript_text: text || null,
            source: source || 'manual',
            file_url: fileUrl || null,
            extraction_status: 'pending',
          },
        ])
        .select('id')
        .single();
      if (error) throw error;
      const result = data as unknown as { id: string };
      return { transcriptId: result.id, transcriptText: text, source, triggerExtract: !!triggerExtract };
    },
    onSuccess: ({ transcriptId, transcriptText, source, triggerExtract }) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'transcripts', id] });
      toast.success('Transcript added');
      if (triggerExtract && transcriptText?.trim()) {
        extractTranscriptMutation.mutate({ transcriptId, transcriptText, source });
      }
    },
    onError: () => {
      toast.error('Failed to add transcript');
    }
  });

  const extractTranscriptMutation = useMutation({
    mutationFn: async (params: { transcriptId: string; transcriptText?: string; source?: string }) => {
      let textToExtract = params.transcriptText;
      let sourceToUse = params.source || 'call';

      // If text not provided directly, fetch from local state or DB
      if (!textToExtract) {
        const transcript = transcripts.find(t => t.id === params.transcriptId);
        if (transcript) {
          textToExtract = transcript.transcript_text;
          sourceToUse = transcript.source || 'call';
        } else {
          // Fetch from DB as fallback - use existing buyer_transcripts table
          const { data, error: transcriptError } = await supabase
            .from('buyer_transcripts')
            .select('transcript_text, source')
            .eq('id', params.transcriptId)
            .single();
          if (transcriptError) throw transcriptError;
          const result = data as unknown as { transcript_text?: string; source?: string } | null;
          textToExtract = result?.transcript_text || '';
          sourceToUse = result?.source || 'call';
        }
      }

      if (!textToExtract?.trim()) {
        throw new Error('No transcript text available to extract from. Please add transcript content first.');
      }

      // FIX #5: Pass transcriptId so edge function can update buyer_transcripts.processed_at
      const { data, error } = await invokeWithTimeout<any>('extract-transcript', {
        body: {
          buyerId: id,
          transcriptText: textToExtract,
          source: sourceToUse,
          transcriptId: params.transcriptId // Pass transcript ID for status tracking
        },
        timeoutMs: 120_000,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'transcripts', id] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', id] });
      // Summary dialog handles user feedback - no toast needed
    },
    onError: (error: Error) => {
      toast.error(`Extraction failed: ${error.message}`);
    }
  });

  const deleteTranscriptMutation = useMutation({
    mutationFn: async (transcriptId: string) => {
      // Use existing buyer_transcripts table (unified migration not executed yet)
      const { error } = await supabase
        .from('buyer_transcripts')
        .delete()
        .eq('id', transcriptId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'transcripts', id] });
      toast.success('Transcript deleted');
    },
    onError: () => {
      toast.error('Failed to delete transcript');
    }
  });

  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number; isRunning: boolean }>({ current: 0, total: 0, isRunning: false });
  const [extractionSummary, setExtractionSummary] = useState<{
    open: boolean;
    results: Array<{ fileName?: string; insights?: any; error?: string }>;
    totalCount: number;
    successCount: number;
    errorCount: number;
  }>({ open: false, results: [], totalCount: 0, successCount: 0, errorCount: 0 });

  const handleExtractAll = async () => {
    if (transcripts.length === 0) return;
    
    setExtractionProgress({ current: 0, total: transcripts.length, isRunning: true });
    let successCount = 0;
    let errorCount = 0;
    const results: Array<{ fileName?: string; insights?: any; error?: string }> = [];
    
    for (let i = 0; i < transcripts.length; i++) {
      try {
        const data = await extractTranscriptMutation.mutateAsync({ transcriptId: transcripts[i].id });
        successCount++;
        results.push({ fileName: transcripts[i].file_name || `Transcript ${i + 1}`, insights: data?.insights?.buyer });
      } catch (e: any) {
        // Extraction failed — tracked in results
        errorCount++;
        results.push({ fileName: transcripts[i].file_name || `Transcript ${i + 1}`, error: e?.message || 'Failed' });
      }
      setExtractionProgress({ current: i + 1, total: transcripts.length, isRunning: i < transcripts.length - 1 });
    }
    
    setExtractionProgress(prev => ({ ...prev, isRunning: false }));
    setExtractionSummary({ open: true, results, totalCount: transcripts.length, successCount, errorCount });
  };

  // Also show summary for single extraction
  const handleSingleExtractWithSummary = async (transcriptId: string) => {
    try {
      const transcript = transcripts.find(t => t.id === transcriptId);
      const data = await extractTranscriptMutation.mutateAsync({ transcriptId });
      setExtractionSummary({
        open: true,
        results: [{ fileName: transcript?.file_name || 'Transcript', insights: data?.insights?.buyer }],
        totalCount: 1,
        successCount: 1,
        errorCount: 0,
      });
    } catch (e: any) {
      const transcript = transcripts.find(t => t.id === transcriptId);
      setExtractionSummary({
        open: true,
        results: [{ fileName: transcript?.file_name || 'Transcript', error: e?.message || 'Failed' }],
        totalCount: 1,
        successCount: 0,
        errorCount: 1,
      });
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/buyers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">New Buyer</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create New Buyer</CardTitle>
            <CardDescription>Add a new external buyer to the database</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">New buyer creation form - use the existing flow</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <BuyerDetailHeader
        companyName={buyer?.company_name || ""}
        peFirmName={buyer?.pe_firm_name}
        peFirmId={peFirmRecord?.id || null}
        platformWebsite={buyer?.platform_website || buyer?.company_website}
        hqCity={buyer?.hq_city}
        hqState={buyer?.hq_state}
        hqCountry={buyer?.hq_country}
        investmentDate={buyer?.investment_date}
        dataCompleteness={dataCompleteness}
        onEdit={() => setActiveEditDialog('business')}
        onEnrich={() => enrichMutation.mutate()}
        isEnriching={enrichMutation.isPending}
        backTo={backTo}
        marketplaceFirmId={buyer?.marketplace_firm_id}
      />

      {/* Criteria Completeness Banner */}
      <CriteriaCompletenessBanner
        completenessPercent={dataCompleteness}
        missingFields={missingFields}
        onAutoEnrich={() => enrichMutation.mutate()}
        isEnriching={enrichMutation.isPending}
      />

      {/* Company Overview + Main Contact - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BuyerCompanyOverviewCard
          website={buyer?.platform_website || buyer?.company_website}
          hqCity={buyer?.hq_city}
          hqState={buyer?.hq_state}
          hqCountry={buyer?.hq_country}
          foundedYear={buyer?.founded_year}
          employeeCount={buyer?.num_employees}
          industryVertical={buyer?.industry_vertical}
          numberOfLocations={buyer?.number_of_locations}
          operatingLocations={buyer?.operating_locations}
          onEdit={() => setActiveEditDialog('companyOverview')}
        />
        <MainContactCard
          contacts={contacts as unknown as { id: string; name: string; email?: string | null; phone?: string | null; role?: string | null; linkedin_url?: string | null; is_primary?: boolean }[]}
          onAddContact={() => setIsContactDialogOpen(true)}
          hasFeeAgreement={buyer?.has_fee_agreement || false}
          onFeeAgreementChange={(value) => updateFeeAgreementMutation.mutate(value)}
          feeAgreementDisabled={updateFeeAgreementMutation.isPending}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="engagement" className="text-sm">
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Engagement
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="text-sm">
            <BarChart2 className="mr-1.5 h-3.5 w-3.5" />
            Intelligence
          </TabsTrigger>
          <TabsTrigger value="contacts" className="text-sm">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="agreements" className="text-sm">
            <FileSignature className="mr-1.5 h-3.5 w-3.5" />
            Agreements
          </TabsTrigger>
          <TabsTrigger value="call-history" className="text-sm">
            <Phone className="mr-1.5 h-3.5 w-3.5" />
            Call History
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-sm">
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Documents
          </TabsTrigger>
        </TabsList>

        {/* Engagement Tab (NEW DEFAULT) */}
        <TabsContent value="engagement">
          <BuyerEngagementTab
            buyerId={buyer!.id}
            emailDomain={buyer?.email_domain}
            marketplaceFirmId={buyer?.marketplace_firm_id}
          />
        </TabsContent>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-4">
          {/* Buyer Notes Section */}
          <BuyerNotesSection
            notes={buyer?.notes || null}
            onSave={async (notes) => {
              await updateBuyerMutation.mutateAsync({ notes });
            }}
          />
          {/* Two-Column Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BusinessDescriptionCard
              industryVertical={buyer?.industry_vertical}
              businessSummary={buyer?.business_summary}
              servicesOffered={buyer?.target_services}
              onEdit={() => setActiveEditDialog('business')}
              className="bg-muted/30"
            />
            
            <InvestmentCriteriaCard
              investmentThesis={buyer?.thesis_summary}
              onEdit={() => setActiveEditDialog('investment')}
              className="bg-accent/20"
            />
            
            <BuyerServicesBusinessModelCard
              servicesOffered={buyer?.services_offered}
              businessModel={buyer?.business_type}
              revenueModel={buyer?.revenue_model}
              onEdit={() => setActiveEditDialog('servicesModel')}
              className="bg-accent/20"
            />
            
            <GeographicFootprintCard
              targetGeographies={buyer?.target_geographies}
              operatingLocations={buyer?.operating_locations}
              geographicFootprint={buyer?.geographic_footprint}
              serviceRegions={buyer?.service_regions}
              onEdit={() => setActiveEditDialog('geographic')}
              className="bg-muted/30"
            />
            
            <CustomerEndMarketCard
              primaryCustomerSize={buyer?.primary_customer_size}
              customerGeographicReach={buyer?.customer_geographic_reach}
              customerIndustries={buyer?.customer_industries}
              targetCustomerProfile={buyer?.target_customer_profile}
              onEdit={() => setActiveEditDialog('customer')}
              className="bg-muted/30"
            />
            
            <DealStructureCard
              minRevenue={buyer?.target_revenue_min}
              maxRevenue={buyer?.target_revenue_max}
              minEbitda={buyer?.target_ebitda_min}
              maxEbitda={buyer?.target_ebitda_max}
              acquisitionAppetite={buyer?.acquisition_appetite}
              acquisitionTimeline={buyer?.acquisition_timeline}
              onEdit={() => setActiveEditDialog('dealStructure')}
              className="bg-accent/20"
            />
            
            <AcquisitionHistoryCard
              totalAcquisitions={buyer?.total_acquisitions}
              acquisitionFrequency={buyer?.acquisition_frequency}
              onEdit={() => setActiveEditDialog('acquisition')}
              className="bg-accent/20"
            />
          </div>

          {/* Full Width: Transcripts */}
          <TranscriptsListCard
            transcripts={transcripts}
            buyerId={buyer!.id}
            companyName={buyer!.company_name}
            onAddTranscript={(text, source, fileName, fileUrl, triggerExtract) =>
              addTranscriptMutation.mutateAsync({ text, source, fileName, fileUrl, triggerExtract })
            }
            onExtract={(transcriptId) => handleSingleExtractWithSummary(transcriptId)}
            onExtractAll={handleExtractAll}
            onDelete={(transcriptId) => {
              if (confirm('Delete this transcript?')) {
                deleteTranscriptMutation.mutate(transcriptId);
              }
            }}
            isExtracting={extractTranscriptMutation.isPending || extractionProgress.isRunning}
            extractionProgress={extractionProgress.isRunning ? extractionProgress : undefined}
          />
        </TabsContent>

        {/* Call History Tab */}
        <TabsContent value="call-history" className="space-y-4">
          {/* PhoneBurner Call Activity Timeline */}
          <ContactCallTimeline buyerId={buyer!.id} />

          {/* Fireflies Transcript Search */}
          <Card>
            <CardHeader>
              <CardTitle>Find Call Transcripts</CardTitle>
              <CardDescription>
                Search your Fireflies call history to link relevant conversations with this buyer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FirefliesTranscriptSearch
                buyerId={buyer?.id || ''}
                companyName={buyer?.company_name || buyer?.pe_firm_name || ''}
                peFirmName={buyer?.pe_firm_name}
                platformWebsite={buyer?.platform_website || buyer?.company_website}
                contacts={contacts?.map((c: any) => ({ email: c.email })) || []}
                onTranscriptLinked={() => {
                  queryClient.invalidateQueries({ queryKey: ['remarketing', 'transcripts', id] });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab (REBUILT) */}
        <TabsContent value="contacts">
          <BuyerContactsHub
            buyerId={buyer!.id}
            emailDomain={buyer?.email_domain}
            onAddContact={() => setIsContactDialogOpen(true)}
            onDeleteContact={(contactId) => deleteContactMutation.mutate(contactId)}
          />
        </TabsContent>

        {/* Agreements Tab (REBUILT) */}
        <TabsContent value="agreements">
          <BuyerAgreementsRebuild
            marketplaceFirmId={buyer?.marketplace_firm_id || null}
            hasFeeAgreement={buyer?.has_fee_agreement || false}
            feeAgreementSource={buyer?.fee_agreement_source || null}
            primaryContactEmail={contacts?.[0]?.email}
            primaryContactName={contacts?.[0]?.name}
          />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <BuyerDealHistoryPanel buyerId={id!} />
        </TabsContent>
      </Tabs>

      {/* Add Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Add a new contact for this buyer</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Name *</Label>
              <Input
                id="contact_name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Phone</Label>
              <Input
                id="contact_phone"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_role">Role</Label>
              <Input
                id="contact_role"
                placeholder="e.g., Managing Partner"
                value={newContact.role}
                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_linkedin">LinkedIn URL</Label>
              <Input
                id="contact_linkedin"
                placeholder="https://linkedin.com/in/..."
                value={newContact.linkedin_url}
                onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => addContactMutation.mutate()}
              disabled={!newContact.name || addContactMutation.isPending}
            >
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialogs */}
      <EditBusinessDescriptionDialog
        open={activeEditDialog === 'business'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        data={{
          industryVertical: buyer?.industry_vertical,
          businessSummary: buyer?.business_summary,
          servicesOffered: buyer?.target_services,
        }}
        onSave={(data) => updateBuyerMutation.mutate(data)}
        isSaving={updateBuyerMutation.isPending}
      />

      <EditInvestmentCriteriaDialog
        open={activeEditDialog === 'investment'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        data={{
          investmentThesis: buyer?.thesis_summary,
        }}
        onSave={(data) => updateBuyerMutation.mutate(data)}
        isSaving={updateBuyerMutation.isPending}
      />

      <EditDealStructureDialog
        open={activeEditDialog === 'dealStructure'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        data={{
          minRevenue: buyer?.target_revenue_min,
          maxRevenue: buyer?.target_revenue_max,
          minEbitda: buyer?.target_ebitda_min,
          maxEbitda: buyer?.target_ebitda_max,
          acquisitionAppetite: buyer?.acquisition_appetite,
          acquisitionTimeline: buyer?.acquisition_timeline,
        }}
        onSave={(data) => updateBuyerMutation.mutate(data)}
        isSaving={updateBuyerMutation.isPending}
      />

      <EditGeographicFootprintDialog
        open={activeEditDialog === 'geographic'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        data={{
          targetGeographies: buyer?.target_geographies,
        }}
        onSave={(data) => updateBuyerMutation.mutate(data)}
        isSaving={updateBuyerMutation.isPending}
      />

      <EditCustomerInfoDialog
        open={activeEditDialog === 'customer'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        data={{
          primaryCustomerSize: buyer?.primary_customer_size,
          customerGeographicReach: buyer?.customer_geographic_reach,
          customerIndustries: buyer?.customer_industries,
          targetCustomerProfile: buyer?.target_customer_profile,
        }}
        onSave={(data) => updateBuyerMutation.mutate(data)}
        isSaving={updateBuyerMutation.isPending}
      />

      <EditAcquisitionHistoryDialog
        open={activeEditDialog === 'acquisition'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        data={{
          totalAcquisitions: buyer?.total_acquisitions,
          acquisitionFrequency: buyer?.acquisition_frequency,
        }}
        onSave={(data) => updateBuyerMutation.mutate(data)}
        isSaving={updateBuyerMutation.isPending}
      />

      <EditBuyerCompanyOverviewDialog
        open={activeEditDialog === 'companyOverview'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        website={buyer?.platform_website || buyer?.company_website}
        hqCity={buyer?.hq_city}
        hqState={buyer?.hq_state}
        hqCountry={buyer?.hq_country}
        foundedYear={buyer?.founded_year}
        employeeCount={buyer?.num_employees}
        industryVertical={buyer?.industry_vertical}
        numberOfLocations={buyer?.number_of_locations}
        onSave={async (data) => {
          // Map to actual column names
          const updateData: Record<string, unknown> = {};
          if (data.company_website !== undefined) updateData.company_website = data.company_website;
          if (data.hq_city !== undefined) updateData.hq_city = data.hq_city;
          if (data.hq_state !== undefined) updateData.hq_state = data.hq_state;
          if (data.hq_country !== undefined) updateData.hq_country = data.hq_country;
          if (data.industry_vertical !== undefined) updateData.industry_vertical = data.industry_vertical;
          // These columns may not exist yet - only update if schema supports them
          if (data.founded_year !== undefined) updateData.founded_year = data.founded_year;
          if (data.num_employees !== undefined) updateData.num_employees = data.num_employees;
          if (data.number_of_locations !== undefined) updateData.number_of_locations = data.number_of_locations;
          updateBuyerMutation.mutate(updateData);
        }}
        isSaving={updateBuyerMutation.isPending}
      />

      <EditBuyerServicesBusinessModelDialog
        open={activeEditDialog === 'servicesModel'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        servicesOffered={buyer?.services_offered}
        businessModel={buyer?.business_type}
        revenueModel={buyer?.revenue_model}
        onSave={async (data) => {
          updateBuyerMutation.mutate(data);
        }}
        isSaving={updateBuyerMutation.isPending}
      />

      <ExtractionSummaryDialog
        open={extractionSummary.open}
        onOpenChange={(open) => setExtractionSummary(prev => ({ ...prev, open }))}
        results={extractionSummary.results}
        totalCount={extractionSummary.totalCount}
        successCount={extractionSummary.successCount}
        errorCount={extractionSummary.errorCount}
      />
    </div>
  );
};

export default ReMarketingBuyerDetail;
