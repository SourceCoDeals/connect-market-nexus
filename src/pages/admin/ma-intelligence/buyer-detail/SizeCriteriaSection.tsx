import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { BuyerSectionProps } from "./types";

export function SizeCriteriaSection({
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
      title="Size Criteria"
      description="Revenue and EBITDA preferences"
      isEditing={isEditing}
      onEdit={onEdit}
      onSave={onSave}
      onCancel={onCancel}
    >
      {isEditing ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Min Revenue ($M)</Label>
            <Input
              type="number"
              value={formData.min_revenue || ""}
              onChange={(e) =>
                onSetFormData({
                  ...formData,
                  min_revenue: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Max Revenue ($M)</Label>
            <Input
              type="number"
              value={formData.max_revenue || ""}
              onChange={(e) =>
                onSetFormData({
                  ...formData,
                  max_revenue: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Min EBITDA ($M)</Label>
            <Input
              type="number"
              value={formData.min_ebitda || ""}
              onChange={(e) =>
                onSetFormData({
                  ...formData,
                  min_ebitda: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Max EBITDA ($M)</Label>
            <Input
              type="number"
              value={formData.max_ebitda || ""}
              onChange={(e) =>
                onSetFormData({
                  ...formData,
                  max_ebitda: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Preferred EBITDA ($M)</Label>
            <Input
              type="number"
              value={formData.preferred_ebitda || ""}
              onChange={(e) =>
                onSetFormData({
                  ...formData,
                  preferred_ebitda: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium mb-1">Revenue Range</div>
            <div className="text-sm text-muted-foreground">
              ${buyer.min_revenue || 0}M - ${buyer.max_revenue || "\u221E"}M
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">EBITDA Range</div>
            <div className="text-sm text-muted-foreground">
              ${buyer.min_ebitda || 0}M - ${buyer.max_ebitda || "\u221E"}M
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Preferred EBITDA</div>
            <div className="text-sm text-muted-foreground">
              {buyer.preferred_ebitda ? `$${buyer.preferred_ebitda}M` : "\u2014"}
            </div>
          </div>
        </div>
      )}
    </BuyerDataSection>
  );
}
