import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { BuyerSectionProps } from "./types";

export function ContactInfoSection({
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
      title="Contact Information"
      description="Website and social media links"
      isEditing={isEditing}
      onEdit={onEdit}
      onSave={onSave}
      onCancel={onCancel}
    >
      {isEditing ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Platform Website</Label>
            <Input
              type="url"
              value={formData.platform_website || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, platform_website: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>PE Firm Website</Label>
            <Input
              type="url"
              value={formData.pe_firm_website || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, pe_firm_website: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Buyer LinkedIn</Label>
            <Input
              type="url"
              value={formData.buyer_linkedin || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, buyer_linkedin: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>PE Firm LinkedIn</Label>
            <Input
              type="url"
              value={formData.pe_firm_linkedin || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, pe_firm_linkedin: e.target.value })
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium mb-1">Platform Website</div>
            <div className="text-sm">
              {buyer.platform_website ? (
                <a
                  href={buyer.platform_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {buyer.platform_website}
                </a>
              ) : (
                <span className="text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">PE Firm Website</div>
            <div className="text-sm">
              {buyer.pe_firm_website ? (
                <a
                  href={buyer.pe_firm_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {buyer.pe_firm_website}
                </a>
              ) : (
                <span className="text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Buyer LinkedIn</div>
            <div className="text-sm">
              {buyer.buyer_linkedin ? (
                <a
                  href={buyer.buyer_linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {buyer.buyer_linkedin}
                </a>
              ) : (
                <span className="text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">PE Firm LinkedIn</div>
            <div className="text-sm">
              {buyer.pe_firm_linkedin ? (
                <a
                  href={buyer.pe_firm_linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {buyer.pe_firm_linkedin}
                </a>
              ) : (
                <span className="text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </BuyerDataSection>
  );
}
