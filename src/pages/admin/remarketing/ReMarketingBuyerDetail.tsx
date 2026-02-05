import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  BarChart3,
  Plus,
  Trash2,
  Users,
  Mail,
  Phone,
  Linkedin,
  BarChart2,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import type { BuyerType } from "@/types/remarketing";
import {
  BuyerDetailHeader,
  CriteriaCompletenessBanner,
  MainContactCard,
  FeeAgreementToggle,
  BusinessDescriptionCard,
  InvestmentCriteriaCard,
  GeographicFootprintCard,
  DealStructureCard,
  CustomerEndMarketCard,
  AcquisitionHistoryCard,
  KeyQuotesCard,
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
  thesis_confidence: string | null;
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_ebitda_min: number | null;
  target_ebitda_max: number | null;
  revenue_sweet_spot: number | null;
  ebitda_sweet_spot: number | null;
  target_geographies: string[] | null;
  target_services: string[] | null;
  geographic_footprint: string[] | null;
  notes: string | null;
  data_completeness: string | null;
  data_last_updated: string | null;
  pe_firm_name: string | null;
  platform_website: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  has_fee_agreement: boolean | null;
  industry_vertical: string | null;
  business_summary: string | null;
  specialized_focus: string | null;
  strategic_priorities: string[] | null;
  deal_breakers: string[] | null;
  deal_preferences: string | null;
  acquisition_appetite: string | null;
  acquisition_timeline: string | null;
  total_acquisitions: number | null;
  acquisition_frequency: string | null;
  primary_customer_size: string | null;
  customer_geographic_reach: string | null;
  customer_industries: string[] | null;
  target_customer_profile: string | null;
  key_quotes: string[] | null;
  investment_date: string | null;
  founded_year?: number | null;
  num_employees?: number | null;
  employee_range?: string | null;
  number_of_locations?: number | null;
  operating_locations?: string[] | null;
  services_offered?: string | null;
  business_model?: string | null;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as BuyerData;
    },
    enabled: !isNew
  });

  // Fetch contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ['remarketing', 'contacts', id],
    queryFn: async () => {
      if (isNew) return [];
      
      const { data, error } = await supabase
        .from('remarketing_buyer_contacts')
        .select('*')
        .eq('buyer_id', id)
        .order('is_primary', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Contact[];
    },
    enabled: !isNew
  });

  // Fetch transcripts
  const { data: transcripts = [] } = useQuery({
    queryKey: ['remarketing', 'transcripts', id],
    queryFn: async () => {
      if (isNew) return [];
      
      const { data, error } = await supabase
        .from('buyer_transcripts')
        .select('*')
        .eq('buyer_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Transcript[];
    },
    enabled: !isNew
  });

  // Fetch recent scores for this buyer
  const { data: recentScores = [] } = useQuery({
    queryKey: ['remarketing', 'buyer-scores', id],
    queryFn: async () => {
      if (isNew) return [];
      
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select(`
          id,
          composite_score,
          tier,
          status,
          created_at,
          listing:listings(id, title)
        `)
        .eq('buyer_id', id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !isNew
  });

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
      buyer.strategic_priorities?.length,
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
    if (!buyer.strategic_priorities?.length) missing.push("strategic priorities");
    if (!buyer.business_summary) missing.push("business summary");
    
    return missing;
  }, [buyer]);

  // Mutations
  const enrichMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('enrich-buyer', {
        body: { buyerId: id }
      });
      if (error) throw error;
      return data;
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
        .eq('id', id);
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
      const { error } = await supabase
        .from('remarketing_buyers')
        .update({ has_fee_agreement: hasFeeAgreement })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', id] });
      toast.success('Fee agreement updated');
    },
    onError: () => {
      toast.error('Failed to update fee agreement');
    }
  });

  const addContactMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('remarketing_buyer_contacts')
        .insert([{ ...newContact, buyer_id: id }]);
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
        .from('remarketing_buyer_contacts')
        .delete()
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
    mutationFn: async ({ text, source, fileName }: { text: string; source: string; fileName?: string }) => {
      const { error } = await supabase
        .from('buyer_transcripts')
        .insert([{
          buyer_id: id,
          transcript_text: text,
          source,
          file_name: fileName || null
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'transcripts', id] });
      toast.success('Transcript added');
    },
    onError: () => {
      toast.error('Failed to add transcript');
    }
  });

  const extractTranscriptMutation = useMutation({
    mutationFn: async (transcriptId: string) => {
      const transcript = transcripts.find(t => t.id === transcriptId);
      if (!transcript) throw new Error('Transcript not found');
      
      const { data, error } = await supabase.functions.invoke('extract-transcript', {
        body: { buyerId: id, transcriptText: transcript.transcript_text, source: transcript.source || 'call' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'transcripts', id] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', id] });
      toast.success('Intelligence extracted');
    },
    onError: (error: Error) => {
      toast.error(`Extraction failed: ${error.message}`);
    }
  });

  const deleteTranscriptMutation = useMutation({
    mutationFn: async (transcriptId: string) => {
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

  const handleExtractAll = async () => {
    const pendingTranscripts = transcripts.filter(t => !t.processed_at);
    for (const transcript of pendingTranscripts) {
      await extractTranscriptMutation.mutateAsync(transcript.id);
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
            <Link to="/admin/remarketing/buyers">
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <BuyerDetailHeader
        companyName={buyer?.company_name || ""}
        peFirmName={buyer?.pe_firm_name}
        platformWebsite={buyer?.platform_website || buyer?.company_website}
        hqCity={buyer?.hq_city}
        hqState={buyer?.hq_state}
        hqCountry={buyer?.hq_country}
        investmentDate={buyer?.investment_date}
        dataCompleteness={dataCompleteness}
        onEdit={() => setActiveEditDialog('business')}
        onEnrich={() => enrichMutation.mutate()}
        isEnriching={enrichMutation.isPending}
      />

      {/* Criteria Completeness Banner */}
      <CriteriaCompletenessBanner
        completenessPercent={dataCompleteness}
        missingFields={missingFields}
        onAutoEnrich={() => enrichMutation.mutate()}
        isEnriching={enrichMutation.isPending}
      />

      {/* Company Overview Card - NEW POSITION (at top) */}
      <BuyerCompanyOverviewCard
        website={buyer?.platform_website || buyer?.company_website}
        hqCity={buyer?.hq_city}
        hqState={buyer?.hq_state}
        hqCountry={buyer?.hq_country}
        foundedYear={buyer?.founded_year}
        employeeCount={buyer?.num_employees}
        employeeRange={buyer?.employee_range}
        industryVertical={buyer?.industry_vertical}
        numberOfLocations={buyer?.number_of_locations}
        operatingLocations={buyer?.operating_locations}
        onEdit={() => setActiveEditDialog('companyOverview')}
      />

      {/* Main Contact Card - MOVED BELOW Company Overview */}
      <MainContactCard
        contacts={contacts}
        onAddContact={() => setIsContactDialogOpen(true)}
      />

      {/* Fee Agreement Toggle */}
      <FeeAgreementToggle
        hasFeeAgreement={buyer?.has_fee_agreement || false}
        onChange={(value) => updateFeeAgreementMutation.mutate(value)}
        disabled={updateFeeAgreementMutation.isPending}
      />

      {/* Main Content Tabs */}
      <Tabs defaultValue="intelligence" className="space-y-6">
        <TabsList>
          <TabsTrigger value="intelligence">
            <BarChart2 className="mr-2 h-4 w-4" />
            Intelligence
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="mr-2 h-4 w-4" />
            Deal History ({recentScores?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="mr-2 h-4 w-4" />
            Contacts ({contacts?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-6">
          {/* Two Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <BusinessDescriptionCard
                industryVertical={buyer?.industry_vertical}
                businessSummary={buyer?.business_summary}
                servicesOffered={buyer?.target_services}
                specializedFocus={buyer?.specialized_focus}
                onEdit={() => setActiveEditDialog('business')}
              />
              
              <BuyerServicesBusinessModelCard
                servicesOffered={buyer?.services_offered}
                businessModel={buyer?.business_model}
                revenueModel={buyer?.revenue_model}
                onEdit={() => setActiveEditDialog('servicesModel')}
              />
              
              <GeographicFootprintCard
                targetGeographies={buyer?.target_geographies}
                operatingLocations={buyer?.operating_locations}
                onEdit={() => setActiveEditDialog('geographic')}
              />
              
              <CustomerEndMarketCard
                primaryCustomerSize={buyer?.primary_customer_size}
                customerGeographicReach={buyer?.customer_geographic_reach}
                customerIndustries={buyer?.customer_industries}
                targetCustomerProfile={buyer?.target_customer_profile}
                onEdit={() => setActiveEditDialog('customer')}
              />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <InvestmentCriteriaCard
                investmentThesis={buyer?.thesis_summary}
                thesisConfidence={buyer?.thesis_confidence}
                strategicPriorities={buyer?.strategic_priorities}
                dealBreakers={buyer?.deal_breakers}
                onEdit={() => setActiveEditDialog('investment')}
              />
              
              <DealStructureCard
                minRevenue={buyer?.target_revenue_min}
                maxRevenue={buyer?.target_revenue_max}
                revenueSweetSpot={buyer?.revenue_sweet_spot}
                minEbitda={buyer?.target_ebitda_min}
                maxEbitda={buyer?.target_ebitda_max}
                ebitdaSweetSpot={buyer?.ebitda_sweet_spot}
                dealPreferences={buyer?.deal_preferences}
                acquisitionAppetite={buyer?.acquisition_appetite}
                acquisitionTimeline={buyer?.acquisition_timeline}
                onEdit={() => setActiveEditDialog('dealStructure')}
              />
              
              <AcquisitionHistoryCard
                totalAcquisitions={buyer?.total_acquisitions}
                acquisitionFrequency={buyer?.acquisition_frequency}
                onEdit={() => setActiveEditDialog('acquisition')}
              />
            </div>
          </div>

          {/* Full Width: Key Quotes */}
          <KeyQuotesCard quotes={buyer?.key_quotes} />

          {/* Full Width: Transcripts */}
          <TranscriptsListCard
            transcripts={transcripts}
            onAddTranscript={(text, source, fileName) => 
              addTranscriptMutation.mutate({ text, source, fileName })
            }
            onExtract={(transcriptId) => extractTranscriptMutation.mutate(transcriptId)}
            onExtractAll={handleExtractAll}
            onDelete={(transcriptId) => {
              if (confirm('Delete this transcript?')) {
                deleteTranscriptMutation.mutate(transcriptId);
              }
            }}
            isAdding={addTranscriptMutation.isPending}
            isExtracting={extractTranscriptMutation.isPending}
          />
        </TabsContent>

        {/* Deal History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Match History</CardTitle>
              <CardDescription>Recent scoring activity for this buyer</CardDescription>
            </CardHeader>
            <CardContent>
              {recentScores?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No matches scored yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Listing</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentScores?.map((score: any) => (
                      <TableRow key={score.id}>
                        <TableCell>
                          <Link 
                            to={`/admin/remarketing/matching/${score.listing?.id}`}
                            className="font-medium hover:underline"
                          >
                            {score.listing?.title || 'Unknown'}
                          </Link>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {Math.round(score.composite_score)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            score.tier === 'A' ? 'default' :
                            score.tier === 'B' ? 'secondary' :
                            'outline'
                          }>
                            Tier {score.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            score.status === 'approved' ? 'default' :
                            score.status === 'passed' ? 'secondary' :
                            'outline'
                          }>
                            {score.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(score.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Contacts</CardTitle>
                  <CardDescription>Key contacts at this organization</CardDescription>
                </div>
                <Button size="sm" onClick={() => setIsContactDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {contacts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No contacts added yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>LinkedIn</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts?.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          {contact.name}
                          {contact.is_primary && (
                            <Badge variant="secondary" className="ml-2">Primary</Badge>
                          )}
                        </TableCell>
                        <TableCell>{contact.role || '—'}</TableCell>
                        <TableCell>
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </a>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {contact.phone ? (
                            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:underline">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </a>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {contact.linkedin_url ? (
                            <a 
                              href={contact.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <Linkedin className="h-3 w-3" />
                              Profile
                            </a>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (confirm('Delete this contact?')) {
                                deleteContactMutation.mutate(contact.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
          specializedFocus: buyer?.specialized_focus,
        }}
        onSave={(data) => updateBuyerMutation.mutate(data)}
        isSaving={updateBuyerMutation.isPending}
      />

      <EditInvestmentCriteriaDialog
        open={activeEditDialog === 'investment'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        data={{
          investmentThesis: buyer?.thesis_summary,
          thesisConfidence: buyer?.thesis_confidence,
          strategicPriorities: buyer?.strategic_priorities,
          dealBreakers: buyer?.deal_breakers,
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
          revenueSweetSpot: buyer?.revenue_sweet_spot,
          minEbitda: buyer?.target_ebitda_min,
          maxEbitda: buyer?.target_ebitda_max,
          ebitdaSweetSpot: buyer?.ebitda_sweet_spot,
          dealPreferences: buyer?.deal_preferences,
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
        employeeRange={buyer?.employee_range}
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
          if (data.employee_range !== undefined) updateData.employee_range = data.employee_range;
          if (data.number_of_locations !== undefined) updateData.number_of_locations = data.number_of_locations;
          updateBuyerMutation.mutate(updateData);
        }}
        isSaving={updateBuyerMutation.isPending}
      />

      <EditBuyerServicesBusinessModelDialog
        open={activeEditDialog === 'servicesModel'}
        onOpenChange={(open) => !open && setActiveEditDialog(null)}
        servicesOffered={buyer?.services_offered}
        businessModel={buyer?.business_model}
        revenueModel={buyer?.revenue_model}
        onSave={async (data) => {
          updateBuyerMutation.mutate(data);
        }}
        isSaving={updateBuyerMutation.isPending}
      />
    </div>
  );
};

export default ReMarketingBuyerDetail;
