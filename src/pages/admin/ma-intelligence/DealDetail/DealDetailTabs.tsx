import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChipInput } from "@/components/ui/chip-input";
import { DealDataSection } from "@/components/ma-intelligence/DealDataSection";
import { DealActivitySection } from "@/components/ma-intelligence/DealActivitySection";
import { DealTranscriptsTab } from "@/components/ma-intelligence/DealTranscriptsTab";
import { DataRoomTab } from "@/components/admin/data-room/DataRoomTab";
import { DealMatchedBuyersTab } from "@/components/ma-intelligence/DealMatchedBuyersTab";
import type { DealDetailTabsProps } from "./types";
import { DealDetailSidebar } from "./DealDetailSidebar";

export function DealDetailTabs({
  deal,
  activeTab,
  onTabChange,
  editingSection,
  formData,
  onSetFormData,
  onEditSection,
  onSaveSection,
  onCancelEdit,
  onLoadDeal: _onLoadDeal,
  scoringState,
  onSetScoringState,
  onSaveScoringAdjustments,
  onArchive,
  onDelete,
}: DealDetailTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="matched-buyers">Matched Buyers</TabsTrigger>
        <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
        <TabsTrigger value="data-room">Data Room</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-4">
        {/* Company Information Section */}
        <DealDataSection
          title="Company Information"
          description="Basic company details and contact information"
          isEditing={editingSection === "company"}
          onEdit={() => onEditSection("company")}
          onSave={() => onSaveSection("company")}
          onCancel={() => onCancelEdit("company")}
        >
          {editingSection === "company" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={formData.deal_name || ""} onChange={(e) => onSetFormData({ ...formData, deal_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Company Website</Label>
                  <Input type="url" value={formData.company_website || ""} onChange={(e) => onSetFormData({ ...formData, company_website: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Company Address</Label>
                <Input value={formData.company_address || ""} onChange={(e) => onSetFormData({ ...formData, company_address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Contact Name</Label>
                  <Input value={formData.contact_name || ""} onChange={(e) => onSetFormData({ ...formData, contact_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Title</Label>
                  <Input value={formData.contact_title || ""} onChange={(e) => onSetFormData({ ...formData, contact_title: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" value={formData.contact_email || ""} onChange={(e) => onSetFormData({ ...formData, contact_email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input type="tel" value={formData.contact_phone || ""} onChange={(e) => onSetFormData({ ...formData, contact_phone: e.target.value })} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">Company Name</div>
                  <div className="text-sm text-muted-foreground">{deal.deal_name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Company Website</div>
                  <div className="text-sm">
                    {deal.company_website ? (
                      <a href={deal.company_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{deal.company_website}</a>
                    ) : (<span className="text-muted-foreground">{"\u2014"}</span>)}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Company Address</div>
                <div className="text-sm text-muted-foreground">{deal.company_address || "\u2014"}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">Primary Contact</div>
                  <div className="text-sm text-muted-foreground">{deal.contact_name || "\u2014"}{deal.contact_title && ` \u2022 ${deal.contact_title}`}</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Contact Info</div>
                  <div className="text-sm">
                    {deal.contact_email && (<a href={`mailto:${deal.contact_email}`} className="text-primary hover:underline block">{deal.contact_email}</a>)}
                    {deal.contact_phone && (<a href={`tel:${deal.contact_phone}`} className="text-primary hover:underline block">{deal.contact_phone}</a>)}
                    {!deal.contact_email && !deal.contact_phone && (<span className="text-muted-foreground">{"\u2014"}</span>)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DealDataSection>

        {/* Business Details Section */}
        <DealDataSection
          title="Business Details"
          description="Industry, services, and business model information"
          isEditing={editingSection === "business"}
          onEdit={() => onEditSection("business")}
          onSave={() => onSaveSection("business")}
          onCancel={() => onCancelEdit("business")}
        >
          {editingSection === "business" ? (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Industry</Label><Input value={formData.industry_type || ""} onChange={(e) => onSetFormData({ ...formData, industry_type: e.target.value })} /></div>
              <div className="space-y-2"><Label>Business Description</Label><Textarea value={formData.company_overview || ""} onChange={(e) => onSetFormData({ ...formData, company_overview: e.target.value })} rows={4} /></div>
              <div className="space-y-2"><Label>Service Mix</Label><Textarea value={formData.service_mix || ""} onChange={(e) => onSetFormData({ ...formData, service_mix: e.target.value })} rows={3} /></div>
              <div className="space-y-2"><Label>Business Model</Label><Input value={formData.business_model || ""} onChange={(e) => onSetFormData({ ...formData, business_model: e.target.value })} /></div>
              <div className="space-y-2"><Label>Customer Industries</Label><Input value={formData.end_market_customers || ""} onChange={(e) => onSetFormData({ ...formData, end_market_customers: e.target.value })} /></div>
              <div className="space-y-2"><Label>Customer Geographic Reach</Label><Input value={formData.customer_geography || ""} onChange={(e) => onSetFormData({ ...formData, customer_geography: e.target.value })} /></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div><div className="text-sm font-medium mb-1">Industry</div><div className="text-sm text-muted-foreground">{deal.industry_type || "\u2014"}</div></div>
              <div><div className="text-sm font-medium mb-1">Business Description</div><div className="text-sm text-muted-foreground whitespace-pre-wrap">{deal.company_overview || "No description available"}</div></div>
              <div><div className="text-sm font-medium mb-1">Service Mix</div><div className="text-sm text-muted-foreground">{deal.service_mix || "\u2014"}</div></div>
              <div><div className="text-sm font-medium mb-1">Business Model</div><div className="text-sm text-muted-foreground">{deal.business_model || "\u2014"}</div></div>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-sm font-medium mb-1">Customer Industries</div><div className="text-sm text-muted-foreground">{deal.end_market_customers || "\u2014"}</div></div>
                <div><div className="text-sm font-medium mb-1">Customer Geographic Reach</div><div className="text-sm text-muted-foreground">{deal.customer_geography || "\u2014"}</div></div>
              </div>
            </div>
          )}
        </DealDataSection>

        {/* Financial Information Section */}
        <DealDataSection
          title="Financial Information"
          description="Revenue, EBITDA, and financial metrics"
          isEditing={editingSection === "financial"}
          onEdit={() => onEditSection("financial")}
          onSave={() => onSaveSection("financial")}
          onCancel={() => onCancelEdit("financial")}
        >
          {editingSection === "financial" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Revenue ($)</Label><Input type="number" value={formData.revenue || ""} onChange={(e) => onSetFormData({ ...formData, revenue: e.target.value ? Number(e.target.value) : null })} /></div>
                <div className="space-y-2"><Label>EBITDA ($)</Label><Input type="number" value={formData.ebitda_amount || ""} onChange={(e) => onSetFormData({ ...formData, ebitda_amount: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>EBITDA Percentage (%)</Label><Input type="number" value={formData.ebitda_percentage || ""} onChange={(e) => onSetFormData({ ...formData, ebitda_percentage: e.target.value ? Number(e.target.value) : null })} /></div>
                <div className="space-y-2"><Label>Employees</Label><Input type="number" value={formData.employee_count || ""} onChange={(e) => onSetFormData({ ...formData, employee_count: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="space-y-2"><Label>Year Founded</Label><Input type="number" value={formData.founded_year || ""} onChange={(e) => onSetFormData({ ...formData, founded_year: e.target.value ? Number(e.target.value) : null })} /></div>
              <div className="space-y-2"><Label>Financial Notes</Label><Textarea value={formData.financial_notes || ""} onChange={(e) => onSetFormData({ ...formData, financial_notes: e.target.value })} rows={3} /></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">Revenue</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.revenue ? `$${deal.revenue >= 1000000 ? `${(deal.revenue / 1000000).toFixed(1)}M` : `${(deal.revenue / 1000).toFixed(0)}K`}` : "\u2014"}
                    {deal.revenue_confidence && ` (${deal.revenue_confidence})`}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">EBITDA</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.ebitda_amount ? `$${deal.ebitda_amount >= 1000000 ? `${(deal.ebitda_amount / 1000000).toFixed(1)}M` : `${(deal.ebitda_amount / 1000).toFixed(0)}K`}` : deal.ebitda_percentage ? `${deal.ebitda_percentage}%` : "\u2014"}
                    {deal.ebitda_confidence && ` (${deal.ebitda_confidence})`}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-sm font-medium mb-1">Employees</div><div className="text-sm text-muted-foreground">{deal.employee_count || "\u2014"}</div></div>
                <div><div className="text-sm font-medium mb-1">Year Founded</div><div className="text-sm text-muted-foreground">{deal.founded_year || "\u2014"}</div></div>
              </div>
              {deal.industry_kpis && Object.keys(deal.industry_kpis).length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Industry KPIs</div>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">{JSON.stringify(deal.industry_kpis, null, 2)}</pre>
                </div>
              )}
              {deal.financial_notes && (
                <div><div className="text-sm font-medium mb-1">Financial Notes</div><div className="text-sm text-muted-foreground whitespace-pre-wrap">{deal.financial_notes}</div></div>
              )}
            </div>
          )}
        </DealDataSection>

        {/* Location Information Section */}
        <DealDataSection
          title="Location Information"
          description="Headquarters and operating locations"
          isEditing={editingSection === "location"}
          onEdit={() => onEditSection("location")}
          onSave={() => onSaveSection("location")}
          onCancel={() => onCancelEdit("location")}
        >
          {editingSection === "location" ? (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Headquarters</Label><Input value={formData.headquarters || ""} onChange={(e) => onSetFormData({ ...formData, headquarters: e.target.value })} placeholder="City, State, Country" /></div>
              <div className="space-y-2"><Label>Geographic Footprint</Label><ChipInput value={formData.geography || []} onChange={(value) => onSetFormData({ ...formData, geography: value })} placeholder="Add location and press Enter" /></div>
              <div className="space-y-2"><Label>Number of Locations</Label><Input type="number" value={formData.location_count || ""} onChange={(e) => onSetFormData({ ...formData, location_count: e.target.value ? Number(e.target.value) : null })} /></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div><div className="text-sm font-medium mb-1">Headquarters</div><div className="text-sm text-muted-foreground">{deal.headquarters || "\u2014"}</div></div>
              <div>
                <div className="text-sm font-medium mb-1">Geographic Footprint</div>
                <div className="flex flex-wrap gap-1">
                  {deal.geography && deal.geography.length > 0 ? deal.geography.map((location) => (<Badge key={location} variant="secondary">{location}</Badge>)) : (<span className="text-sm text-muted-foreground">{"\u2014"}</span>)}
                </div>
              </div>
              <div><div className="text-sm font-medium mb-1">Number of Locations</div><div className="text-sm text-muted-foreground">{deal.location_count || "\u2014"}</div></div>
            </div>
          )}
        </DealDataSection>

        {/* Owner Information Section */}
        <DealDataSection
          title="Owner Information"
          description="Owner motivations and transition goals"
          isEditing={editingSection === "owner"}
          onEdit={() => onEditSection("owner")}
          onSave={() => onSaveSection("owner")}
          onCancel={() => onCancelEdit("owner")}
        >
          {editingSection === "owner" ? (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Owner Goals</Label><Textarea value={formData.owner_goals || ""} onChange={(e) => onSetFormData({ ...formData, owner_goals: e.target.value })} rows={3} /></div>
              <div className="space-y-2"><Label>Special Requirements</Label><Textarea value={formData.special_requirements || ""} onChange={(e) => onSetFormData({ ...formData, special_requirements: e.target.value })} rows={3} /></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div><div className="text-sm font-medium mb-1">Owner Goals</div><div className="text-sm text-muted-foreground whitespace-pre-wrap">{deal.owner_goals || "\u2014"}</div></div>
              <div><div className="text-sm font-medium mb-1">Special Requirements</div><div className="text-sm text-muted-foreground whitespace-pre-wrap">{deal.special_requirements || "\u2014"}</div></div>
            </div>
          )}
        </DealDataSection>

        {/* Deal Status Section */}
        <DealDataSection
          title="Deal Status"
          description="Current status and metadata"
          isEditing={editingSection === "status"}
          onEdit={() => onEditSection("status")}
          onSave={() => onSaveSection("status")}
          onCancel={() => onCancelEdit("status")}
        >
          {editingSection === "status" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status || ""} onValueChange={(value) => onSetFormData({ ...formData, status: value })}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-sm font-medium mb-1">Status</div><div className="text-sm text-muted-foreground"><Badge variant={deal.status === "active" ? "default" : "secondary"}>{deal.status || "Unknown"}</Badge></div></div>
                <div><div className="text-sm font-medium mb-1">Created</div><div className="text-sm text-muted-foreground">{new Date(deal.created_at).toLocaleDateString()}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-sm font-medium mb-1">Last Updated</div><div className="text-sm text-muted-foreground">{new Date(deal.updated_at).toLocaleDateString()}</div></div>
                <div><div className="text-sm font-medium mb-1">Last Enriched</div><div className="text-sm text-muted-foreground">{deal.last_enriched_at ? new Date(deal.last_enriched_at).toLocaleDateString() : "Never"}</div></div>
              </div>
            </div>
          )}
        </DealDataSection>
      </TabsContent>

      {/* Matched Buyers Tab */}
      <TabsContent value="matched-buyers">
        <DealMatchedBuyersTab dealId={deal.id} />
      </TabsContent>

      {/* Transcripts Tab */}
      <TabsContent value="transcripts">
        <DealTranscriptsTab dealId={deal.id} />
      </TabsContent>

      {/* Data Room Tab */}
      <TabsContent value="data-room">
        <DataRoomTab dealId={deal.id} dealTitle={deal.deal_name} />
      </TabsContent>

      {/* Activity Tab */}
      <TabsContent value="activity">
        <Card>
          <CardHeader><CardTitle>Deal Activity</CardTitle></CardHeader>
          <CardContent><DealActivitySection dealId={deal.id} /></CardContent>
        </Card>
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="space-y-4">
        <DealDetailSidebar
          deal={deal}
          scoringState={scoringState}
          onSetScoringState={onSetScoringState}
          onSaveScoringAdjustments={onSaveScoringAdjustments}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      </TabsContent>
    </Tabs>
  );
}
