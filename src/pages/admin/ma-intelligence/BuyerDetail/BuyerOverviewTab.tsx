import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipInput } from "@/components/ui/chip-input";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import { BuyerNotesSection } from "@/components/remarketing/buyer-detail/BuyerNotesSection";
import type { MABuyer } from "@/lib/ma-intelligence/types";

interface BuyerOverviewTabProps {
  buyer: MABuyer;
  formData: Partial<MABuyer>;
  setFormData: (data: Partial<MABuyer>) => void;
  editingSection: string | null;
  setEditingSection: (section: string | null) => void;
  handleSaveSection: (section: string) => void;
  handleCancelEdit: () => void;
  handleSaveNotes: (notes: string) => Promise<void>;
  handleAnalyzeNotes: (notes: string) => Promise<void>;
  isAnalyzingNotes: boolean;
}

export function BuyerOverviewTab({
  buyer, formData, setFormData, editingSection, setEditingSection,
  handleSaveSection, handleCancelEdit, handleSaveNotes, handleAnalyzeNotes, isAnalyzingNotes,
}: BuyerOverviewTabProps) {
  return (
    <div className="space-y-4">
      {/* Notes */}
      <BuyerNotesSection notes={buyer.notes} onSave={handleSaveNotes} isAnalyzing={isAnalyzingNotes} onAnalyze={handleAnalyzeNotes} />

      {/* Business Summary */}
      <BuyerDataSection title="Business Summary" description="Core business information and overview" isEditing={editingSection === "business"} onEdit={() => setEditingSection("business")} onSave={() => handleSaveSection("business")} onCancel={handleCancelEdit}>
        {editingSection === "business" ? (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Business Summary</Label><Textarea value={formData.business_summary || ""} onChange={(e) => setFormData({ ...formData, business_summary: e.target.value })} rows={4} /></div>
            <div className="space-y-2"><Label>Industry Vertical</Label><Input value={formData.industry_vertical || ""} onChange={(e) => setFormData({ ...formData, industry_vertical: e.target.value })} /></div>
            <div className="space-y-2"><Label>Services Offered</Label><Textarea value={formData.services_offered || ""} onChange={(e) => setFormData({ ...formData, services_offered: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Business Model</Label><Textarea value={formData.business_model || ""} onChange={(e) => setFormData({ ...formData, business_model: e.target.value })} rows={3} /></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div><div className="text-sm font-medium mb-1">Business Summary</div><div className="text-sm text-muted-foreground whitespace-pre-wrap">{buyer.business_summary || "No business summary available"}</div></div>
            <div><div className="text-sm font-medium mb-1">Industry Vertical</div><div className="text-sm text-muted-foreground">{buyer.industry_vertical || "\u2014"}</div></div>
            <div><div className="text-sm font-medium mb-1">Services Offered</div><div className="text-sm text-muted-foreground">{buyer.services_offered || "\u2014"}</div></div>
            <div><div className="text-sm font-medium mb-1">Business Model</div><div className="text-sm text-muted-foreground">{buyer.business_model || "\u2014"}</div></div>
          </div>
        )}
      </BuyerDataSection>

      {/* Thesis & Preferences */}
      <BuyerDataSection title="Thesis & Preferences" description="Investment thesis and strategic preferences" isEditing={editingSection === "thesis"} onEdit={() => setEditingSection("thesis")} onSave={() => handleSaveSection("thesis")} onCancel={handleCancelEdit}>
        {editingSection === "thesis" ? (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Thesis Summary</Label><Textarea value={formData.thesis_summary || ""} onChange={(e) => setFormData({ ...formData, thesis_summary: e.target.value })} rows={4} /></div>
            <div className="space-y-2"><Label>Thesis Confidence</Label><Select value={formData.thesis_confidence || ""} onValueChange={(v: any) => setFormData({ ...formData, thesis_confidence: v })}><SelectTrigger><SelectValue placeholder="Select confidence" /></SelectTrigger><SelectContent><SelectItem value="High">High</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Low">Low</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Service Mix Preferences</Label><Textarea value={formData.service_mix_prefs || ""} onChange={(e) => setFormData({ ...formData, service_mix_prefs: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Target Services</Label><ChipInput value={formData.target_services || []} onChange={(v) => setFormData({ ...formData, target_services: v })} placeholder="Add service and press Enter" /></div>
            <div className="space-y-2"><Label>Required Capabilities</Label><ChipInput value={formData.required_capabilities || []} onChange={(v) => setFormData({ ...formData, required_capabilities: v })} placeholder="Add capability and press Enter" /></div>
            <div className="space-y-2"><Label>Target Industries</Label><ChipInput value={formData.target_industries || []} onChange={(v) => setFormData({ ...formData, target_industries: v })} placeholder="Add industry and press Enter" /></div>
            <div className="space-y-2"><Label>Industry Exclusions</Label><ChipInput value={formData.industry_exclusions || []} onChange={(v) => setFormData({ ...formData, industry_exclusions: v })} placeholder="Add exclusion and press Enter" /></div>
            <div className="space-y-2"><Label>Business Model Preferences</Label><Textarea value={formData.business_model_prefs || ""} onChange={(e) => setFormData({ ...formData, business_model_prefs: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Business Model Exclusions</Label><ChipInput value={formData.business_model_exclusions || []} onChange={(v) => setFormData({ ...formData, business_model_exclusions: v })} placeholder="Add exclusion and press Enter" /></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><div><div className="text-sm font-medium mb-1">Thesis Summary</div><div className="text-sm text-muted-foreground whitespace-pre-wrap">{buyer.thesis_summary || "No thesis summary available"}</div></div>{buyer.thesis_confidence && <Badge variant={buyer.thesis_confidence === "High" ? "default" : buyer.thesis_confidence === "Medium" ? "secondary" : "outline"}>{buyer.thesis_confidence} Confidence</Badge>}</div>
            <div><div className="text-sm font-medium mb-1">Service Mix Preferences</div><div className="text-sm text-muted-foreground">{buyer.service_mix_prefs || "\u2014"}</div></div>
            <div><div className="text-sm font-medium mb-1">Target Services</div><div className="flex flex-wrap gap-1">{buyer.target_services?.length ? buyer.target_services.map(s => <Badge key={s} variant="secondary">{s}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
            <div><div className="text-sm font-medium mb-1">Required Capabilities</div><div className="flex flex-wrap gap-1">{buyer.required_capabilities?.length ? buyer.required_capabilities.map(c => <Badge key={c} variant="secondary">{c}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
            <div><div className="text-sm font-medium mb-1">Target Industries</div><div className="flex flex-wrap gap-1">{buyer.target_industries?.length ? buyer.target_industries.map(i => <Badge key={i} variant="secondary">{i}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
            <div><div className="text-sm font-medium mb-1">Industry Exclusions</div><div className="flex flex-wrap gap-1">{buyer.industry_exclusions?.length ? buyer.industry_exclusions.map(e => <Badge key={e} variant="outline">{e}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
            <div><div className="text-sm font-medium mb-1">Business Model Preferences</div><div className="text-sm text-muted-foreground">{buyer.business_model_prefs || "\u2014"}</div></div>
            <div><div className="text-sm font-medium mb-1">Business Model Exclusions</div><div className="flex flex-wrap gap-1">{buyer.business_model_exclusions?.length ? buyer.business_model_exclusions.map(e => <Badge key={e} variant="outline">{e}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
          </div>
        )}
      </BuyerDataSection>

      {/* Size Criteria */}
      <BuyerDataSection title="Size Criteria" description="Revenue and EBITDA preferences" isEditing={editingSection === "size"} onEdit={() => setEditingSection("size")} onSave={() => handleSaveSection("size")} onCancel={handleCancelEdit}>
        {editingSection === "size" ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Min Revenue ($M)</Label><Input type="number" value={formData.min_revenue || ""} onChange={(e) => setFormData({ ...formData, min_revenue: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="space-y-2"><Label>Max Revenue ($M)</Label><Input type="number" value={formData.max_revenue || ""} onChange={(e) => setFormData({ ...formData, max_revenue: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="space-y-2"><Label>Min EBITDA ($M)</Label><Input type="number" value={formData.min_ebitda || ""} onChange={(e) => setFormData({ ...formData, min_ebitda: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="space-y-2"><Label>Max EBITDA ($M)</Label><Input type="number" value={formData.max_ebitda || ""} onChange={(e) => setFormData({ ...formData, max_ebitda: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="space-y-2 col-span-2"><Label>Preferred EBITDA ($M)</Label><Input type="number" value={formData.preferred_ebitda || ""} onChange={(e) => setFormData({ ...formData, preferred_ebitda: e.target.value ? Number(e.target.value) : null })} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div><div className="text-sm font-medium mb-1">Revenue Range</div><div className="text-sm text-muted-foreground">${buyer.min_revenue || 0}M - ${buyer.max_revenue || "\u221E"}M</div></div>
            <div><div className="text-sm font-medium mb-1">EBITDA Range</div><div className="text-sm text-muted-foreground">${buyer.min_ebitda || 0}M - ${buyer.max_ebitda || "\u221E"}M</div></div>
            <div><div className="text-sm font-medium mb-1">Preferred EBITDA</div><div className="text-sm text-muted-foreground">{buyer.preferred_ebitda ? `$${buyer.preferred_ebitda}M` : "\u2014"}</div></div>
          </div>
        )}
      </BuyerDataSection>

      {/* Geographic Preferences */}
      <BuyerDataSection title="Geographic Preferences" description="Target locations and geographic focus" isEditing={editingSection === "geography"} onEdit={() => setEditingSection("geography")} onSave={() => handleSaveSection("geography")} onCancel={handleCancelEdit}>
        {editingSection === "geography" ? (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Geographic Footprint</Label><ChipInput value={formData.geographic_footprint || []} onChange={(v) => setFormData({ ...formData, geographic_footprint: v })} placeholder="Add location and press Enter" /></div>
            <div className="space-y-2"><Label>Target Geographies</Label><ChipInput value={formData.target_geographies || []} onChange={(v) => setFormData({ ...formData, target_geographies: v })} placeholder="Add geography and press Enter" /></div>
            <div className="space-y-2"><Label>Geographic Exclusions</Label><ChipInput value={formData.geographic_exclusions || []} onChange={(v) => setFormData({ ...formData, geographic_exclusions: v })} placeholder="Add exclusion and press Enter" /></div>
            <div className="space-y-2"><Label>Acquisition Geography</Label><ChipInput value={formData.acquisition_geography || []} onChange={(v) => setFormData({ ...formData, acquisition_geography: v })} placeholder="Add geography and press Enter" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>HQ City</Label><Input value={formData.hq_city || ""} onChange={(e) => setFormData({ ...formData, hq_city: e.target.value })} /></div>
              <div className="space-y-2"><Label>HQ State</Label><Input value={formData.hq_state || ""} onChange={(e) => setFormData({ ...formData, hq_state: e.target.value })} /></div>
              <div className="space-y-2"><Label>HQ Country</Label><Input value={formData.hq_country || ""} onChange={(e) => setFormData({ ...formData, hq_country: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Other Office Locations</Label><ChipInput value={formData.other_office_locations || []} onChange={(v) => setFormData({ ...formData, other_office_locations: v })} placeholder="Add office location and press Enter" /></div>
            <div className="space-y-2"><Label>Service Regions</Label><ChipInput value={formData.service_regions || []} onChange={(v) => setFormData({ ...formData, service_regions: v })} placeholder="Add region and press Enter" /></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div><div className="text-sm font-medium mb-1">Geographic Footprint</div><div className="flex flex-wrap gap-1">{buyer.geographic_footprint?.length ? buyer.geographic_footprint.map(l => <Badge key={l} variant="secondary">{l}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
            <div><div className="text-sm font-medium mb-1">Target Geographies</div><div className="flex flex-wrap gap-1">{buyer.target_geographies?.length ? buyer.target_geographies.map(g => <Badge key={g} variant="secondary">{g}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
            <div><div className="text-sm font-medium mb-1">Geographic Exclusions</div><div className="flex flex-wrap gap-1">{buyer.geographic_exclusions?.length ? buyer.geographic_exclusions.map(e => <Badge key={e} variant="outline">{e}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
            <div className="grid grid-cols-3 gap-4">
              <div><div className="text-sm font-medium mb-1">HQ City</div><div className="text-sm text-muted-foreground">{buyer.hq_city || "\u2014"}</div></div>
              <div><div className="text-sm font-medium mb-1">HQ State</div><div className="text-sm text-muted-foreground">{buyer.hq_state || "\u2014"}</div></div>
              <div><div className="text-sm font-medium mb-1">HQ Country</div><div className="text-sm text-muted-foreground">{buyer.hq_country || "\u2014"}</div></div>
            </div>
            <div><div className="text-sm font-medium mb-1">Other Office Locations</div><div className="flex flex-wrap gap-1">{buyer.other_office_locations?.length ? buyer.other_office_locations.map(l => <Badge key={l} variant="secondary">{l}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
          </div>
        )}
      </BuyerDataSection>

      {/* Acquisition Strategy */}
      <BuyerDataSection title="Acquisition Strategy" description="Deal preferences and acquisition history" isEditing={editingSection === "acquisition"} onEdit={() => setEditingSection("acquisition")} onSave={() => handleSaveSection("acquisition")} onCancel={handleCancelEdit}>
        {editingSection === "acquisition" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2"><Checkbox id="addon_only" checked={formData.addon_only || false} onCheckedChange={(c) => setFormData({ ...formData, addon_only: !!c })} /><Label htmlFor="addon_only">Add-on Only</Label></div>
              <div className="flex items-center space-x-2"><Checkbox id="platform_only" checked={formData.platform_only || false} onCheckedChange={(c) => setFormData({ ...formData, platform_only: !!c })} /><Label htmlFor="platform_only">Platform Only</Label></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Total Acquisitions</Label><Input type="number" value={formData.total_acquisitions || ""} onChange={(e) => setFormData({ ...formData, total_acquisitions: e.target.value ? Number(e.target.value) : null })} /></div>
              <div className="space-y-2"><Label>Acquisition Frequency</Label><Input value={formData.acquisition_frequency || ""} onChange={(e) => setFormData({ ...formData, acquisition_frequency: e.target.value })} placeholder="e.g., 2-3 per year" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Last Acquisition Date</Label><Input type="date" value={formData.last_acquisition_date || ""} onChange={(e) => setFormData({ ...formData, last_acquisition_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Acquisition Appetite</Label><Select value={formData.acquisition_appetite || ""} onValueChange={(v) => setFormData({ ...formData, acquisition_appetite: v })}><SelectTrigger><SelectValue placeholder="Select appetite" /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Selective">Selective</SelectItem><SelectItem value="Opportunistic">Opportunistic</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Acquisition Timeline</Label><Input value={formData.acquisition_timeline || ""} onChange={(e) => setFormData({ ...formData, acquisition_timeline: e.target.value })} placeholder="e.g., Next 12 months" /></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><span className="text-sm font-medium">Add-on Only:</span><Badge variant={buyer.addon_only ? "default" : "outline"}>{buyer.addon_only ? "Yes" : "No"}</Badge></div>
              <div className="flex items-center gap-2"><span className="text-sm font-medium">Platform Only:</span><Badge variant={buyer.platform_only ? "default" : "outline"}>{buyer.platform_only ? "Yes" : "No"}</Badge></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm font-medium mb-1">Total Acquisitions</div><div className="text-sm text-muted-foreground">{buyer.total_acquisitions || "\u2014"}</div></div>
              <div><div className="text-sm font-medium mb-1">Acquisition Frequency</div><div className="text-sm text-muted-foreground">{buyer.acquisition_frequency || "\u2014"}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm font-medium mb-1">Last Acquisition Date</div><div className="text-sm text-muted-foreground">{buyer.last_acquisition_date || "\u2014"}</div></div>
              <div><div className="text-sm font-medium mb-1">Acquisition Appetite</div><div className="text-sm text-muted-foreground">{buyer.acquisition_appetite || "\u2014"}</div></div>
            </div>
            <div><div className="text-sm font-medium mb-1">Acquisition Timeline</div><div className="text-sm text-muted-foreground">{buyer.acquisition_timeline || "\u2014"}</div></div>
          </div>
        )}
      </BuyerDataSection>

      {/* Owner Transition */}
      <BuyerDataSection title="Owner Transition" description="Owner requirements and transition preferences" isEditing={editingSection === "owner"} onEdit={() => setEditingSection("owner")} onSave={() => handleSaveSection("owner")} onCancel={handleCancelEdit}>
        {editingSection === "owner" ? (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Owner Roll Requirement</Label><Textarea value={formData.owner_roll_requirement || ""} onChange={(e) => setFormData({ ...formData, owner_roll_requirement: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Owner Transition Goals</Label><Textarea value={formData.owner_transition_goals || ""} onChange={(e) => setFormData({ ...formData, owner_transition_goals: e.target.value })} rows={3} /></div>
            <div className="space-y-2"><Label>Employee Owner</Label><Input value={formData.employee_owner || ""} onChange={(e) => setFormData({ ...formData, employee_owner: e.target.value })} /></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div><div className="text-sm font-medium mb-1">Owner Roll Requirement</div><div className="text-sm text-muted-foreground">{buyer.owner_roll_requirement || "\u2014"}</div></div>
            <div><div className="text-sm font-medium mb-1">Owner Transition Goals</div><div className="text-sm text-muted-foreground">{buyer.owner_transition_goals || "\u2014"}</div></div>
            <div><div className="text-sm font-medium mb-1">Employee Owner</div><div className="text-sm text-muted-foreground">{buyer.employee_owner || "\u2014"}</div></div>
          </div>
        )}
      </BuyerDataSection>

      {/* Portfolio & Operations */}
      <BuyerDataSection title="Portfolio & Operations" description="Portfolio companies and operational details" isEditing={editingSection === "portfolio"} onEdit={() => setEditingSection("portfolio")} onSave={() => handleSaveSection("portfolio")} onCancel={handleCancelEdit}>
        {editingSection === "portfolio" ? (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Number of Platforms</Label><Input type="number" value={formData.num_platforms || ""} onChange={(e) => setFormData({ ...formData, num_platforms: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="space-y-2"><Label>Portfolio Companies</Label><ChipInput value={formData.portfolio_companies || []} onChange={(v) => setFormData({ ...formData, portfolio_companies: v })} placeholder="Add company and press Enter" /></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div><div className="text-sm font-medium mb-1">Number of Platforms</div><div className="text-sm text-muted-foreground">{buyer.num_platforms || "\u2014"}</div></div>
            <div><div className="text-sm font-medium mb-1">Portfolio Companies</div><div className="flex flex-wrap gap-1">{buyer.portfolio_companies?.length ? buyer.portfolio_companies.map(c => <Badge key={c} variant="secondary">{c}</Badge>) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}</div></div>
            {buyer.recent_acquisitions?.length ? (
              <div><div className="text-sm font-medium mb-2">Recent Acquisitions</div><div className="space-y-3">{buyer.recent_acquisitions.map(acq => (<div key={acq.company} className="border-l-2 pl-3 space-y-1"><div className="font-medium text-sm">{acq.company}</div>{acq.date && <div className="text-xs text-muted-foreground">{acq.date}</div>}{acq.location && <div className="text-xs text-muted-foreground">{acq.location}</div>}{acq.description && <div className="text-xs text-muted-foreground">{acq.description}</div>}</div>))}</div></div>
            ) : null}
          </div>
        )}
      </BuyerDataSection>

      {/* Contact Information */}
      <BuyerDataSection title="Contact Information" description="Website and social media links" isEditing={editingSection === "contact"} onEdit={() => setEditingSection("contact")} onSave={() => handleSaveSection("contact")} onCancel={handleCancelEdit}>
        {editingSection === "contact" ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Platform Website</Label><Input type="url" value={formData.platform_website || ""} onChange={(e) => setFormData({ ...formData, platform_website: e.target.value })} /></div>
            <div className="space-y-2"><Label>PE Firm Website</Label><Input type="url" value={formData.pe_firm_website || ""} onChange={(e) => setFormData({ ...formData, pe_firm_website: e.target.value })} /></div>
            <div className="space-y-2"><Label>Buyer LinkedIn</Label><Input type="url" value={formData.buyer_linkedin || ""} onChange={(e) => setFormData({ ...formData, buyer_linkedin: e.target.value })} /></div>
            <div className="space-y-2"><Label>PE Firm LinkedIn</Label><Input type="url" value={formData.pe_firm_linkedin || ""} onChange={(e) => setFormData({ ...formData, pe_firm_linkedin: e.target.value })} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Platform Website", value: buyer.platform_website },
              { label: "PE Firm Website", value: buyer.pe_firm_website },
              { label: "Buyer LinkedIn", value: buyer.buyer_linkedin },
              { label: "PE Firm LinkedIn", value: buyer.pe_firm_linkedin },
            ].map(({ label, value }) => (
              <div key={label}><div className="text-sm font-medium mb-1">{label}</div><div className="text-sm">{value ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{value}</a> : <span className="text-muted-foreground">{"\u2014"}</span>}</div></div>
            ))}
          </div>
        )}
      </BuyerDataSection>
    </div>
  );
}
