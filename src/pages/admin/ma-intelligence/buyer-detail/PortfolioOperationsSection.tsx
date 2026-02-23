import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipInput } from "@/components/ui/chip-input";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { BuyerSectionProps } from "./types";

export function PortfolioOperationsSection({
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
      title="Portfolio & Operations"
      description="Portfolio companies and operational details"
      isEditing={isEditing}
      onEdit={onEdit}
      onSave={onSave}
      onCancel={onCancel}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Number of Platforms</Label>
            <Input
              type="number"
              value={formData.num_platforms || ""}
              onChange={(e) =>
                onSetFormData({
                  ...formData,
                  num_platforms: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Portfolio Companies</Label>
            <ChipInput
              value={formData.portfolio_companies || []}
              onChange={(value) =>
                onSetFormData({ ...formData, portfolio_companies: value })
              }
              placeholder="Add company and press Enter"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Number of Platforms</div>
            <div className="text-sm text-muted-foreground">
              {buyer.num_platforms || "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Portfolio Companies</div>
            <div className="flex flex-wrap gap-1">
              {buyer.portfolio_companies && buyer.portfolio_companies.length > 0 ? (
                buyer.portfolio_companies.map((company) => (
                  <Badge key={company} variant="secondary">
                    {company}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          {buyer.recent_acquisitions && buyer.recent_acquisitions.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Recent Acquisitions</div>
              <div className="space-y-3">
                {buyer.recent_acquisitions.map((acq) => (
                  <div key={acq.company} className="border-l-2 pl-3 space-y-1">
                    <div className="font-medium text-sm">{acq.company}</div>
                    {acq.date && (
                      <div className="text-xs text-muted-foreground">{acq.date}</div>
                    )}
                    {acq.location && (
                      <div className="text-xs text-muted-foreground">{acq.location}</div>
                    )}
                    {acq.description && (
                      <div className="text-xs text-muted-foreground">
                        {acq.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </BuyerDataSection>
  );
}
