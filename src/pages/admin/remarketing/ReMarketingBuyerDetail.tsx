import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ArrowLeft,
  Save,
  Building2,
  Users,
  BarChart3,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Mail,
  Phone,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { EnrichmentButton, IntelligenceBadge, TranscriptSection } from "@/components/remarketing";
import type { BuyerType, DataCompleteness } from "@/types/remarketing";

const BUYER_TYPES: { value: BuyerType; label: string }[] = [
  { value: 'pe_firm', label: 'PE Firm' },
  { value: 'platform', label: 'Platform' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'other', label: 'Other' },
];

const ReMarketingBuyerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [formData, setFormData] = useState({
    company_name: '',
    company_website: '',
    buyer_type: 'pe_firm' as BuyerType,
    universe_id: '',
    thesis_summary: '',
    target_revenue_min: '',
    target_revenue_max: '',
    target_ebitda_min: '',
    target_ebitda_max: '',
    target_geographies: [] as string[],
    target_services: [] as string[],
    geographic_footprint: [] as string[],
    notes: '',
  });

  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    is_primary: false,
  });
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  // Fetch buyer if editing
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
      return data;
    },
    enabled: !isNew
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['remarketing', 'contacts', id],
    queryFn: async () => {
      if (isNew) return [];
      
      const { data, error } = await supabase
        .from('remarketing_buyer_contacts')
        .select('*')
        .eq('buyer_id', id)
        .order('is_primary', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !isNew
  });

  // Fetch universes for dropdown
  const { data: universes } = useQuery({
    queryKey: ['remarketing', 'universes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('id, name')
        .eq('archived', false)
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch recent scores for this buyer
  const { data: recentScores } = useQuery({
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

  // Update form when buyer loads
  useEffect(() => {
    if (buyer) {
      setFormData({
        company_name: buyer.company_name || '',
        company_website: buyer.company_website || '',
        buyer_type: (buyer.buyer_type as BuyerType) || 'pe_firm',
        universe_id: buyer.universe_id || '',
        thesis_summary: buyer.thesis_summary || '',
        target_revenue_min: buyer.target_revenue_min?.toString() || '',
        target_revenue_max: buyer.target_revenue_max?.toString() || '',
        target_ebitda_min: buyer.target_ebitda_min?.toString() || '',
        target_ebitda_max: buyer.target_ebitda_max?.toString() || '',
        target_geographies: buyer.target_geographies || [],
        target_services: buyer.target_services || [],
        geographic_footprint: buyer.geographic_footprint || [],
        notes: buyer.notes || '',
      });
    }
  }, [buyer]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_name: formData.company_name,
        company_website: formData.company_website || null,
        buyer_type: formData.buyer_type,
        universe_id: formData.universe_id || null,
        thesis_summary: formData.thesis_summary || null,
        target_revenue_min: formData.target_revenue_min ? parseFloat(formData.target_revenue_min) : null,
        target_revenue_max: formData.target_revenue_max ? parseFloat(formData.target_revenue_max) : null,
        target_ebitda_min: formData.target_ebitda_min ? parseFloat(formData.target_ebitda_min) : null,
        target_ebitda_max: formData.target_ebitda_max ? parseFloat(formData.target_ebitda_max) : null,
        target_geographies: formData.target_geographies,
        target_services: formData.target_services,
        geographic_footprint: formData.geographic_footprint,
        notes: formData.notes || null,
      };

      if (isNew) {
        const { data, error } = await supabase
          .from('remarketing_buyers')
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { error } = await supabase
          .from('remarketing_buyers')
          .update(payload)
          .eq('id', id);
        
        if (error) throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyer', id] });
      toast.success(isNew ? 'Buyer created' : 'Buyer saved');
      if (isNew && data?.id) {
        navigate(`/admin/remarketing/buyers/${data.id}`);
      }
    },
    onError: () => {
      toast.error('Failed to save buyer');
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
      setNewContact({ name: '', email: '', phone: '', role: '', is_primary: false });
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

  const handleArrayInput = (field: 'target_geographies' | 'target_services' | 'geographic_footprint', value: string) => {
    const items = value.split(',').map(s => s.trim()).filter(Boolean);
    setFormData({ ...formData, [field]: items });
  };

  if (!isNew && isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/remarketing/buyers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? 'New Buyer' : formData.company_name || 'Buyer'}
            </h1>
            <p className="text-muted-foreground">
              {isNew ? 'Add a new external buyer' : 'Edit buyer details and contacts'}
            </p>
          </div>
          {!isNew && buyer && (
            <IntelligenceBadge 
              completeness={(buyer.data_completeness as DataCompleteness) || null} 
              size="md"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <EnrichmentButton
              buyerId={id!}
              buyerName={formData.company_name}
              hasWebsite={!!formData.company_website}
              lastEnriched={buyer?.data_last_updated}
            />
          )}
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={!formData.company_name || saveMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">
            <Building2 className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="criteria">
            <Sparkles className="mr-2 h-4 w-4" />
            Investment Criteria
          </TabsTrigger>
          {!isNew && (
            <>
              <TabsTrigger value="contacts">
                <Users className="mr-2 h-4 w-4" />
                Contacts ({contacts?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="transcripts">
                <FileText className="mr-2 h-4 w-4" />
                Transcripts
              </TabsTrigger>
              <TabsTrigger value="history">
                <BarChart3 className="mr-2 h-4 w-4" />
                Match History
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
              <CardDescription>Basic information about this buyer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    placeholder="e.g., Blackstone"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_website">Website</Label>
                  <Input
                    id="company_website"
                    placeholder="https://example.com"
                    value={formData.company_website}
                    onChange={(e) => setFormData({ ...formData, company_website: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Buyer Type</Label>
                  <Select
                    value={formData.buyer_type}
                    onValueChange={(value) => setFormData({ ...formData, buyer_type: value as BuyerType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUYER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Universe</Label>
                  <Select
                    value={formData.universe_id}
                    onValueChange={(value) => setFormData({ ...formData, universe_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select universe (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {universes?.map((universe) => (
                        <SelectItem key={universe.id} value={universe.id}>
                          {universe.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thesis_summary">Investment Thesis</Label>
                <Textarea
                  id="thesis_summary"
                  placeholder="Describe this buyer's investment thesis and focus areas..."
                  value={formData.thesis_summary}
                  onChange={(e) => setFormData({ ...formData, thesis_summary: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this buyer..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Investment Criteria Tab */}
        <TabsContent value="criteria">
          <Card>
            <CardHeader>
              <CardTitle>Investment Criteria</CardTitle>
              <CardDescription>Target deal size and characteristics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Target Revenue Range</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="target_revenue_min">Minimum ($)</Label>
                    <Input
                      id="target_revenue_min"
                      type="number"
                      placeholder="e.g., 5000000"
                      value={formData.target_revenue_min}
                      onChange={(e) => setFormData({ ...formData, target_revenue_min: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_revenue_max">Maximum ($)</Label>
                    <Input
                      id="target_revenue_max"
                      type="number"
                      placeholder="e.g., 50000000"
                      value={formData.target_revenue_max}
                      onChange={(e) => setFormData({ ...formData, target_revenue_max: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Target EBITDA Range</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="target_ebitda_min">Minimum ($)</Label>
                    <Input
                      id="target_ebitda_min"
                      type="number"
                      placeholder="e.g., 1000000"
                      value={formData.target_ebitda_min}
                      onChange={(e) => setFormData({ ...formData, target_ebitda_min: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_ebitda_max">Maximum ($)</Label>
                    <Input
                      id="target_ebitda_max"
                      type="number"
                      placeholder="e.g., 10000000"
                      value={formData.target_ebitda_max}
                      onChange={(e) => setFormData({ ...formData, target_ebitda_max: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_geographies">Target Geographies</Label>
                <Input
                  id="target_geographies"
                  placeholder="e.g., Texas, Florida, Southeast (comma-separated)"
                  value={formData.target_geographies.join(', ')}
                  onChange={(e) => handleArrayInput('target_geographies', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">States or regions the buyer is targeting</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_services">Target Services/Industries</Label>
                <Input
                  id="target_services"
                  placeholder="e.g., HVAC, Plumbing, Electrical (comma-separated)"
                  value={formData.target_services.join(', ')}
                  onChange={(e) => handleArrayInput('target_services', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">Service types or industries the buyer focuses on</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="geographic_footprint">Current Footprint</Label>
                <Input
                  id="geographic_footprint"
                  placeholder="e.g., California, Arizona (comma-separated)"
                  value={formData.geographic_footprint.join(', ')}
                  onChange={(e) => handleArrayInput('geographic_footprint', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">Where the buyer currently operates</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        {!isNew && (
          <TabsContent value="contacts">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Contacts</CardTitle>
                    <CardDescription>Key contacts at this organization</CardDescription>
                  </div>
                  <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Contact
                      </Button>
                    </DialogTrigger>
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
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts?.map((contact: any) => (
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
        )}

        {/* Transcripts Tab */}
        {!isNew && (
          <TabsContent value="transcripts">
            <TranscriptSection 
              buyerId={id!} 
              buyerName={formData.company_name}
            />
          </TabsContent>
        )}

        {/* Match History Tab */}
        {!isNew && (
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
        )}
      </Tabs>
    </div>
  );
};

export default ReMarketingBuyerDetail;
