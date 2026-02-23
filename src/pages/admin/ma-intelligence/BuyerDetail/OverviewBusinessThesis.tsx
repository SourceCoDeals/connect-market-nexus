import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChipInput } from "@/components/ui/chip-input";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import { BuyerNotesSection } from "@/components/remarketing/buyer-detail/BuyerNotesSection";
import type { MABuyer } from "@/lib/ma-intelligence/types";

interface OverviewBusinessThesisProps {
  buyer: MABuyer;
  formData: Partial<MABuyer>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<MABuyer>>>;
  editingSection: string | null;
  setEditingSection: (section: string | null) => void;
  onSaveSection: (section: string) => void;
  onCancelEdit: (section: string) => void;
  isAnalyzingNotes: boolean;
  onSaveNotes: (notes: string) => Promise<void>;
  onAnalyzeNotes: (notes: string) => Promise<void>;
}

export function OverviewBusinessThesis({
  buyer,
  formData,
  setFormData,
  editingSection,
  setEditingSection,
  onSaveSection,
  onCancelEdit,
  isAnalyzingNotes,
  onSaveNotes,
  onAnalyzeNotes,
}: OverviewBusinessThesisProps) {
  return (
    <>
      {/* General Notes Section */}
      <BuyerNotesSection
        notes={buyer.notes}
        onSave={onSaveNotes}
        isAnalyzing={isAnalyzingNotes}
        onAnalyze={onAnalyzeNotes}
      />

      {/* Business Summary Section */}
      <BuyerDataSection
        title="Business Summary"
        description="Core business information and overview"
        isEditing={editingSection === "business"}
        onEdit={() => setEditingSection("business")}
        onSave={() => onSaveSection("business")}
        onCancel={() => onCancelEdit("business")}
      >
        {editingSection === "business" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Business Summary</Label>
              <Textarea
                value={formData.business_summary || ""}
                onChange={(e) =>
                  setFormData({ ...formData, business_summary: e.target.value })
                }
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Industry Vertical</Label>
              <Input
                value={formData.industry_vertical || ""}
                onChange={(e) =>
                  setFormData({ ...formData, industry_vertical: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Services Offered</Label>
              <Textarea
                value={formData.services_offered || ""}
                onChange={(e) =>
                  setFormData({ ...formData, services_offered: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Business Model</Label>
              <Textarea
                value={formData.business_model || ""}
                onChange={(e) =>
                  setFormData({ ...formData, business_model: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Business Summary</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {buyer.business_summary || "No business summary available"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Industry Vertical</div>
              <div className="text-sm text-muted-foreground">
                {buyer.industry_vertical || "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Services Offered</div>
              <div className="text-sm text-muted-foreground">
                {buyer.services_offered || "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Business Model</div>
              <div className="text-sm text-muted-foreground">
                {buyer.business_model || "\u2014"}
              </div>
            </div>
          </div>
        )}
      </BuyerDataSection>

      {/* Thesis & Preferences Section */}
      <BuyerDataSection
        title="Thesis & Preferences"
        description="Investment thesis and strategic preferences"
        isEditing={editingSection === "thesis"}
        onEdit={() => setEditingSection("thesis")}
        onSave={() => onSaveSection("thesis")}
        onCancel={() => onCancelEdit("thesis")}
      >
        {editingSection === "thesis" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Thesis Summary</Label>
              <Textarea
                value={formData.thesis_summary || ""}
                onChange={(e) =>
                  setFormData({ ...formData, thesis_summary: e.target.value })
                }
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Thesis Confidence</Label>
              <Select
                value={formData.thesis_confidence || ""}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, thesis_confidence: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service Mix Preferences</Label>
              <Textarea
                value={formData.service_mix_prefs || ""}
                onChange={(e) =>
                  setFormData({ ...formData, service_mix_prefs: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Services</Label>
              <ChipInput
                value={formData.target_services || []}
                onChange={(value) =>
                  setFormData({ ...formData, target_services: value })
                }
                placeholder="Add service and press Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Required Capabilities</Label>
              <ChipInput
                value={formData.required_capabilities || []}
                onChange={(value) =>
                  setFormData({ ...formData, required_capabilities: value })
                }
                placeholder="Add capability and press Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Industries</Label>
              <ChipInput
                value={formData.target_industries || []}
                onChange={(value) =>
                  setFormData({ ...formData, target_industries: value })
                }
                placeholder="Add industry and press Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Industry Exclusions</Label>
              <ChipInput
                value={formData.industry_exclusions || []}
                onChange={(value) =>
                  setFormData({ ...formData, industry_exclusions: value })
                }
                placeholder="Add exclusion and press Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Business Model Preferences</Label>
              <Textarea
                value={formData.business_model_prefs || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    business_model_prefs: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Business Model Exclusions</Label>
              <ChipInput
                value={formData.business_model_exclusions || []}
                onChange={(value) =>
                  setFormData({ ...formData, business_model_exclusions: value })
                }
                placeholder="Add exclusion and press Enter"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium mb-1">Thesis Summary</div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {buyer.thesis_summary || "No thesis summary available"}
                </div>
              </div>
              {buyer.thesis_confidence && (
                <Badge
                  variant={
                    buyer.thesis_confidence === "High"
                      ? "default"
                      : buyer.thesis_confidence === "Medium"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {buyer.thesis_confidence} Confidence
                </Badge>
              )}
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Service Mix Preferences
              </div>
              <div className="text-sm text-muted-foreground">
                {buyer.service_mix_prefs || "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Target Services</div>
              <div className="flex flex-wrap gap-1">
                {buyer.target_services && buyer.target_services.length > 0 ? (
                  buyer.target_services.map((service) => (
                    <Badge key={service} variant="secondary">
                      {service}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {"\u2014"}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Required Capabilities
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.required_capabilities &&
                buyer.required_capabilities.length > 0 ? (
                  buyer.required_capabilities.map((cap) => (
                    <Badge key={cap} variant="secondary">
                      {cap}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {"\u2014"}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Target Industries</div>
              <div className="flex flex-wrap gap-1">
                {buyer.target_industries &&
                buyer.target_industries.length > 0 ? (
                  buyer.target_industries.map((ind) => (
                    <Badge key={ind} variant="secondary">
                      {ind}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {"\u2014"}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Industry Exclusions
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.industry_exclusions &&
                buyer.industry_exclusions.length > 0 ? (
                  buyer.industry_exclusions.map((exc) => (
                    <Badge key={exc} variant="outline">
                      {exc}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {"\u2014"}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Business Model Preferences
              </div>
              <div className="text-sm text-muted-foreground">
                {buyer.business_model_prefs || "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Business Model Exclusions
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.business_model_exclusions &&
                buyer.business_model_exclusions.length > 0 ? (
                  buyer.business_model_exclusions.map((exc) => (
                    <Badge key={exc} variant="outline">
                      {exc}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {"\u2014"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </BuyerDataSection>
    </>
  );
}
