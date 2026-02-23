import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChipInput } from "@/components/ui/chip-input";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { MABuyer } from "@/lib/ma-intelligence/types";

interface OverviewSizeGeoAcquisitionProps {
  buyer: MABuyer;
  formData: Partial<MABuyer>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<MABuyer>>>;
  editingSection: string | null;
  setEditingSection: (section: string | null) => void;
  onSaveSection: (section: string) => void;
  onCancelEdit: (section: string) => void;
}

export function OverviewSizeGeoAcquisition({
  buyer,
  formData,
  setFormData,
  editingSection,
  setEditingSection,
  onSaveSection,
  onCancelEdit,
}: OverviewSizeGeoAcquisitionProps) {
  return (
    <>
      {/* Size Criteria Section */}
      <BuyerDataSection
        title="Size Criteria"
        description="Revenue and EBITDA preferences"
        isEditing={editingSection === "size"}
        onEdit={() => setEditingSection("size")}
        onSave={() => onSaveSection("size")}
        onCancel={() => onCancelEdit("size")}
      >
        {editingSection === "size" ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Revenue ($M)</Label>
              <Input
                type="number"
                value={formData.min_revenue || ""}
                onChange={(e) =>
                  setFormData({
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
                  setFormData({
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
                  setFormData({
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
                  setFormData({
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
                  setFormData({
                    ...formData,
                    preferred_ebitda: e.target.value
                      ? Number(e.target.value)
                      : null,
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
                {buyer.preferred_ebitda
                  ? `$${buyer.preferred_ebitda}M`
                  : "\u2014"}
              </div>
            </div>
          </div>
        )}
      </BuyerDataSection>

      {/* Geographic Preferences Section */}
      <BuyerDataSection
        title="Geographic Preferences"
        description="Target locations and geographic focus"
        isEditing={editingSection === "geography"}
        onEdit={() => setEditingSection("geography")}
        onSave={() => onSaveSection("geography")}
        onCancel={() => onCancelEdit("geography")}
      >
        {editingSection === "geography" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Geographic Footprint</Label>
              <ChipInput
                value={formData.geographic_footprint || []}
                onChange={(value) =>
                  setFormData({ ...formData, geographic_footprint: value })
                }
                placeholder="Add location and press Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Geographies</Label>
              <ChipInput
                value={formData.target_geographies || []}
                onChange={(value) =>
                  setFormData({ ...formData, target_geographies: value })
                }
                placeholder="Add geography and press Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Geographic Exclusions</Label>
              <ChipInput
                value={formData.geographic_exclusions || []}
                onChange={(value) =>
                  setFormData({ ...formData, geographic_exclusions: value })
                }
                placeholder="Add exclusion and press Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Acquisition Geography</Label>
              <ChipInput
                value={formData.acquisition_geography || []}
                onChange={(value) =>
                  setFormData({ ...formData, acquisition_geography: value })
                }
                placeholder="Add geography and press Enter"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>HQ City</Label>
                <Input
                  value={formData.hq_city || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, hq_city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>HQ State</Label>
                <Input
                  value={formData.hq_state || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, hq_state: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>HQ Country</Label>
                <Input
                  value={formData.hq_country || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, hq_country: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Other Office Locations</Label>
              <ChipInput
                value={formData.other_office_locations || []}
                onChange={(value) =>
                  setFormData({ ...formData, other_office_locations: value })
                }
                placeholder="Add office location and press Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Service Regions</Label>
              <ChipInput
                value={formData.service_regions || []}
                onChange={(value) =>
                  setFormData({ ...formData, service_regions: value })
                }
                placeholder="Add region and press Enter"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">
                Geographic Footprint
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.geographic_footprint &&
                buyer.geographic_footprint.length > 0 ? (
                  buyer.geographic_footprint.map((loc) => (
                    <Badge key={loc} variant="secondary">
                      {loc}
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
                Target Geographies
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.target_geographies &&
                buyer.target_geographies.length > 0 ? (
                  buyer.target_geographies.map((geo) => (
                    <Badge key={geo} variant="secondary">
                      {geo}
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
                Geographic Exclusions
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.geographic_exclusions &&
                buyer.geographic_exclusions.length > 0 ? (
                  buyer.geographic_exclusions.map((exc) => (
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
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm font-medium mb-1">HQ City</div>
                <div className="text-sm text-muted-foreground">
                  {buyer.hq_city || "\u2014"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">HQ State</div>
                <div className="text-sm text-muted-foreground">
                  {buyer.hq_state || "\u2014"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">HQ Country</div>
                <div className="text-sm text-muted-foreground">
                  {buyer.hq_country || "\u2014"}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Other Office Locations
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.other_office_locations &&
                buyer.other_office_locations.length > 0 ? (
                  buyer.other_office_locations.map((loc) => (
                    <Badge key={loc} variant="secondary">
                      {loc}
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

      {/* Acquisition Strategy Section */}
      <BuyerDataSection
        title="Acquisition Strategy"
        description="Deal preferences and acquisition history"
        isEditing={editingSection === "acquisition"}
        onEdit={() => setEditingSection("acquisition")}
        onSave={() => onSaveSection("acquisition")}
        onCancel={() => onCancelEdit("acquisition")}
      >
        {editingSection === "acquisition" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="addon_only"
                  checked={formData.addon_only || false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, addon_only: !!checked })
                  }
                />
                <Label htmlFor="addon_only">Add-on Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="platform_only"
                  checked={formData.platform_only || false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, platform_only: !!checked })
                  }
                />
                <Label htmlFor="platform_only">Platform Only</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Acquisitions</Label>
                <Input
                  type="number"
                  value={formData.total_acquisitions || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      total_acquisitions: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Acquisition Frequency</Label>
                <Input
                  value={formData.acquisition_frequency || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      acquisition_frequency: e.target.value,
                    })
                  }
                  placeholder="e.g., 2-3 per year"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Last Acquisition Date</Label>
                <Input
                  type="date"
                  value={formData.last_acquisition_date || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      last_acquisition_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Acquisition Appetite</Label>
                <Select
                  value={formData.acquisition_appetite || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, acquisition_appetite: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select appetite" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Selective">Selective</SelectItem>
                    <SelectItem value="Opportunistic">Opportunistic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Acquisition Timeline</Label>
              <Input
                value={formData.acquisition_timeline || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    acquisition_timeline: e.target.value,
                  })
                }
                placeholder="e.g., Next 12 months"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Add-on Only:</span>
                <Badge variant={buyer.addon_only ? "default" : "outline"}>
                  {buyer.addon_only ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Platform Only:</span>
                <Badge variant={buyer.platform_only ? "default" : "outline"}>
                  {buyer.platform_only ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-1">
                  Total Acquisitions
                </div>
                <div className="text-sm text-muted-foreground">
                  {buyer.total_acquisitions || "\u2014"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">
                  Acquisition Frequency
                </div>
                <div className="text-sm text-muted-foreground">
                  {buyer.acquisition_frequency || "\u2014"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-1">
                  Last Acquisition Date
                </div>
                <div className="text-sm text-muted-foreground">
                  {buyer.last_acquisition_date || "\u2014"}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">
                  Acquisition Appetite
                </div>
                <div className="text-sm text-muted-foreground">
                  {buyer.acquisition_appetite || "\u2014"}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">
                Acquisition Timeline
              </div>
              <div className="text-sm text-muted-foreground">
                {buyer.acquisition_timeline || "\u2014"}
              </div>
            </div>
          </div>
        )}
      </BuyerDataSection>
    </>
  );
}
