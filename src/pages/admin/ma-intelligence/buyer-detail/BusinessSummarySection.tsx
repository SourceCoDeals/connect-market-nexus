import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { BuyerSectionProps } from "./types";

export function BusinessSummarySection({
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
      title="Business Summary"
      description="Core business information and overview"
      isEditing={isEditing}
      onEdit={onEdit}
      onSave={onSave}
      onCancel={onCancel}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Business Summary</Label>
            <Textarea
              value={formData.business_summary || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, business_summary: e.target.value })
              }
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Industry Vertical</Label>
            <Input
              value={formData.industry_vertical || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, industry_vertical: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Services Offered</Label>
            <Textarea
              value={formData.services_offered || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, services_offered: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Business Model</Label>
            <Textarea
              value={formData.business_model || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, business_model: e.target.value })
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
  );
}
