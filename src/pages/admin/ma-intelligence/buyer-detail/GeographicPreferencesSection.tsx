import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipInput } from "@/components/ui/chip-input";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { BuyerSectionProps } from "./types";

export function GeographicPreferencesSection({
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
      title="Geographic Preferences"
      description="Target locations and geographic focus"
      isEditing={isEditing}
      onEdit={onEdit}
      onSave={onSave}
      onCancel={onCancel}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Geographic Footprint</Label>
            <ChipInput
              value={formData.geographic_footprint || []}
              onChange={(value) =>
                onSetFormData({ ...formData, geographic_footprint: value })
              }
              placeholder="Add location and press Enter"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Geographies</Label>
            <ChipInput
              value={formData.target_geographies || []}
              onChange={(value) =>
                onSetFormData({ ...formData, target_geographies: value })
              }
              placeholder="Add geography and press Enter"
            />
          </div>
          <div className="space-y-2">
            <Label>Geographic Exclusions</Label>
            <ChipInput
              value={formData.geographic_exclusions || []}
              onChange={(value) =>
                onSetFormData({ ...formData, geographic_exclusions: value })
              }
              placeholder="Add exclusion and press Enter"
            />
          </div>
          <div className="space-y-2">
            <Label>Acquisition Geography</Label>
            <ChipInput
              value={formData.acquisition_geography || []}
              onChange={(value) =>
                onSetFormData({ ...formData, acquisition_geography: value })
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
                  onSetFormData({ ...formData, hq_city: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>HQ State</Label>
              <Input
                value={formData.hq_state || ""}
                onChange={(e) =>
                  onSetFormData({ ...formData, hq_state: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>HQ Country</Label>
              <Input
                value={formData.hq_country || ""}
                onChange={(e) =>
                  onSetFormData({ ...formData, hq_country: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Other Office Locations</Label>
            <ChipInput
              value={formData.other_office_locations || []}
              onChange={(value) =>
                onSetFormData({ ...formData, other_office_locations: value })
              }
              placeholder="Add office location and press Enter"
            />
          </div>
          <div className="space-y-2">
            <Label>Service Regions</Label>
            <ChipInput
              value={formData.service_regions || []}
              onChange={(value) =>
                onSetFormData({ ...formData, service_regions: value })
              }
              placeholder="Add region and press Enter"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Geographic Footprint</div>
            <div className="flex flex-wrap gap-1">
              {buyer.geographic_footprint && buyer.geographic_footprint.length > 0 ? (
                buyer.geographic_footprint.map((loc) => (
                  <Badge key={loc} variant="secondary">
                    {loc}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Target Geographies</div>
            <div className="flex flex-wrap gap-1">
              {buyer.target_geographies && buyer.target_geographies.length > 0 ? (
                buyer.target_geographies.map((geo) => (
                  <Badge key={geo} variant="secondary">
                    {geo}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Geographic Exclusions</div>
            <div className="flex flex-wrap gap-1">
              {buyer.geographic_exclusions && buyer.geographic_exclusions.length > 0 ? (
                buyer.geographic_exclusions.map((exc) => (
                  <Badge key={exc} variant="outline">
                    {exc}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">HQ City</div>
              <div className="text-sm text-muted-foreground">{buyer.hq_city || "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">HQ State</div>
              <div className="text-sm text-muted-foreground">{buyer.hq_state || "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">HQ Country</div>
              <div className="text-sm text-muted-foreground">
                {buyer.hq_country || "\u2014"}
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Other Office Locations</div>
            <div className="flex flex-wrap gap-1">
              {buyer.other_office_locations &&
              buyer.other_office_locations.length > 0 ? (
                buyer.other_office_locations.map((loc) => (
                  <Badge key={loc} variant="secondary">
                    {loc}
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
