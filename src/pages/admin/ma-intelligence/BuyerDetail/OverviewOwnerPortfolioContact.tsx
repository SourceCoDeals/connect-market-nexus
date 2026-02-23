import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChipInput } from "@/components/ui/chip-input";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { MABuyer } from "@/lib/ma-intelligence/types";

interface OverviewOwnerPortfolioContactProps {
  buyer: MABuyer;
  formData: Partial<MABuyer>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<MABuyer>>>;
  editingSection: string | null;
  setEditingSection: (section: string | null) => void;
  onSaveSection: (section: string) => void;
  onCancelEdit: (section: string) => void;
}

export function OverviewOwnerPortfolioContact({
  buyer,
  formData,
  setFormData,
  editingSection,
  setEditingSection,
  onSaveSection,
  onCancelEdit,
}: OverviewOwnerPortfolioContactProps) {
  return (
    <>
      {/* Owner Transition Section */}
      <BuyerDataSection
        title="Owner Transition"
        description="Owner requirements and transition preferences"
        isEditing={editingSection === "owner"}
        onEdit={() => setEditingSection("owner")}
        onSave={() => onSaveSection("owner")}
        onCancel={() => onCancelEdit("owner")}
      >
        {editingSection === "owner" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Owner Roll Requirement</Label>
              <Textarea
                value={formData.owner_roll_requirement || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    owner_roll_requirement: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Owner Transition Goals</Label>
              <Textarea
                value={formData.owner_transition_goals || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    owner_transition_goals: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Employee Owner</Label>
              <Input
                value={formData.employee_owner || ""}
                onChange={(e) =>
                  setFormData({ ...formData, employee_owner: e.target.value })
                }
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">
                Owner Roll Requirement
              </div>
              <div className="text-sm text-muted-foreground">
                {buyer.owner_roll_requirement || "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Owner Transition Goals
              </div>
              <div className="text-sm text-muted-foreground">
                {buyer.owner_transition_goals || "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Employee Owner</div>
              <div className="text-sm text-muted-foreground">
                {buyer.employee_owner || "\u2014"}
              </div>
            </div>
          </div>
        )}
      </BuyerDataSection>

      {/* Portfolio & Operations Section */}
      <BuyerDataSection
        title="Portfolio & Operations"
        description="Portfolio companies and operational details"
        isEditing={editingSection === "portfolio"}
        onEdit={() => setEditingSection("portfolio")}
        onSave={() => onSaveSection("portfolio")}
        onCancel={() => onCancelEdit("portfolio")}
      >
        {editingSection === "portfolio" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Number of Platforms</Label>
              <Input
                type="number"
                value={formData.num_platforms || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    num_platforms: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Portfolio Companies</Label>
              <ChipInput
                value={formData.portfolio_companies || []}
                onChange={(value) =>
                  setFormData({ ...formData, portfolio_companies: value })
                }
                placeholder="Add company and press Enter"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">
                Number of Platforms
              </div>
              <div className="text-sm text-muted-foreground">
                {buyer.num_platforms || "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Portfolio Companies
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.portfolio_companies &&
                buyer.portfolio_companies.length > 0 ? (
                  buyer.portfolio_companies.map((company) => (
                    <Badge key={company} variant="secondary">
                      {company}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {"\u2014"}
                  </span>
                )}
              </div>
            </div>
            {buyer.recent_acquisitions &&
              buyer.recent_acquisitions.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">
                    Recent Acquisitions
                  </div>
                  <div className="space-y-3">
                    {buyer.recent_acquisitions.map((acq) => (
                      <div
                        key={acq.company}
                        className="border-l-2 pl-3 space-y-1"
                      >
                        <div className="font-medium text-sm">{acq.company}</div>
                        {acq.date && (
                          <div className="text-xs text-muted-foreground">
                            {acq.date}
                          </div>
                        )}
                        {acq.location && (
                          <div className="text-xs text-muted-foreground">
                            {acq.location}
                          </div>
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

      {/* Contact Information Section */}
      <BuyerDataSection
        title="Contact Information"
        description="Website and social media links"
        isEditing={editingSection === "contact"}
        onEdit={() => setEditingSection("contact")}
        onSave={() => onSaveSection("contact")}
        onCancel={() => onCancelEdit("contact")}
      >
        {editingSection === "contact" ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform Website</Label>
              <Input
                type="url"
                value={formData.platform_website || ""}
                onChange={(e) =>
                  setFormData({ ...formData, platform_website: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>PE Firm Website</Label>
              <Input
                type="url"
                value={formData.pe_firm_website || ""}
                onChange={(e) =>
                  setFormData({ ...formData, pe_firm_website: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Buyer LinkedIn</Label>
              <Input
                type="url"
                value={formData.buyer_linkedin || ""}
                onChange={(e) =>
                  setFormData({ ...formData, buyer_linkedin: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>PE Firm LinkedIn</Label>
              <Input
                type="url"
                value={formData.pe_firm_linkedin || ""}
                onChange={(e) =>
                  setFormData({ ...formData, pe_firm_linkedin: e.target.value })
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
    </>
  );
}
