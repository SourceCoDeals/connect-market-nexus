import { Badge } from "@/components/ui/badge";
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
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { BuyerSectionProps } from "./types";

export function ThesisPreferencesSection({
  buyer,
  isEditing,
  formData,
  onEdit,
  onSave,
  onCancel,
  onSetFormData,
}: BuyerSectionProps) {
  return (
    <BuyerDataSection
      title="Thesis & Preferences"
      description="Investment thesis and strategic preferences"
      isEditing={isEditing}
      onEdit={onEdit}
      onSave={onSave}
      onCancel={onCancel}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Thesis Summary</Label>
            <Textarea
              value={formData.thesis_summary || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, thesis_summary: e.target.value })
              }
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Thesis Confidence</Label>
            <Select
              value={formData.thesis_confidence || ""}
              onValueChange={(value: string) =>
                onSetFormData({ ...formData, thesis_confidence: value })
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
                onSetFormData({ ...formData, service_mix_prefs: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Target Services</Label>
            <ChipInput
              value={formData.target_services || []}
              onChange={(value) =>
                onSetFormData({ ...formData, target_services: value })
              }
              placeholder="Add service and press Enter"
            />
          </div>
          <div className="space-y-2">
            <Label>Required Capabilities</Label>
            <ChipInput
              value={formData.required_capabilities || []}
              onChange={(value) =>
                onSetFormData({ ...formData, required_capabilities: value })
              }
              placeholder="Add capability and press Enter"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Industries</Label>
            <ChipInput
              value={formData.target_industries || []}
              onChange={(value) =>
                onSetFormData({ ...formData, target_industries: value })
              }
              placeholder="Add industry and press Enter"
            />
          </div>
          <div className="space-y-2">
            <Label>Industry Exclusions</Label>
            <ChipInput
              value={formData.industry_exclusions || []}
              onChange={(value) =>
                onSetFormData({ ...formData, industry_exclusions: value })
              }
              placeholder="Add exclusion and press Enter"
            />
          </div>
          <div className="space-y-2">
            <Label>Business Model Preferences</Label>
            <Textarea
              value={formData.business_model_prefs || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, business_model_prefs: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Business Model Exclusions</Label>
            <ChipInput
              value={formData.business_model_exclusions || []}
              onChange={(value) =>
                onSetFormData({ ...formData, business_model_exclusions: value })
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
            <div className="text-sm font-medium mb-1">Service Mix Preferences</div>
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
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Required Capabilities</div>
            <div className="flex flex-wrap gap-1">
              {buyer.required_capabilities && buyer.required_capabilities.length > 0 ? (
                buyer.required_capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary">
                    {cap}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Target Industries</div>
            <div className="flex flex-wrap gap-1">
              {buyer.target_industries && buyer.target_industries.length > 0 ? (
                buyer.target_industries.map((ind) => (
                  <Badge key={ind} variant="secondary">
                    {ind}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Industry Exclusions</div>
            <div className="flex flex-wrap gap-1">
              {buyer.industry_exclusions && buyer.industry_exclusions.length > 0 ? (
                buyer.industry_exclusions.map((exc) => (
                  <Badge key={exc} variant="outline">
                    {exc}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Business Model Preferences</div>
            <div className="text-sm text-muted-foreground">
              {buyer.business_model_prefs || "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Business Model Exclusions</div>
            <div className="flex flex-wrap gap-1">
              {buyer.business_model_exclusions &&
              buyer.business_model_exclusions.length > 0 ? (
                buyer.business_model_exclusions.map((exc) => (
                  <Badge key={exc} variant="outline">
                    {exc}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </BuyerDataSection>
  );
}
