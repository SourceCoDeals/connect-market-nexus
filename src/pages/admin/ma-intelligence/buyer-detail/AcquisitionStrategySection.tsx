import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { BuyerSectionProps } from "./types";

export function AcquisitionStrategySection({
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
      title="Acquisition Strategy"
      description="Deal preferences and acquisition history"
      isEditing={isEditing}
      onEdit={onEdit}
      onSave={onSave}
      onCancel={onCancel}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="addon_only"
                checked={formData.addon_only || false}
                onCheckedChange={(checked) =>
                  onSetFormData({ ...formData, addon_only: !!checked })
                }
              />
              <Label htmlFor="addon_only">Add-on Only</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="platform_only"
                checked={formData.platform_only || false}
                onCheckedChange={(checked) =>
                  onSetFormData({ ...formData, platform_only: !!checked })
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
                  onSetFormData({
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
                  onSetFormData({
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
                  onSetFormData({
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
                  onSetFormData({ ...formData, acquisition_appetite: value })
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
                onSetFormData({ ...formData, acquisition_timeline: e.target.value })
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
              <div className="text-sm font-medium mb-1">Total Acquisitions</div>
              <div className="text-sm text-muted-foreground">
                {buyer.total_acquisitions || "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Acquisition Frequency</div>
              <div className="text-sm text-muted-foreground">
                {buyer.acquisition_frequency || "\u2014"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">Last Acquisition Date</div>
              <div className="text-sm text-muted-foreground">
                {buyer.last_acquisition_date || "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Acquisition Appetite</div>
              <div className="text-sm text-muted-foreground">
                {buyer.acquisition_appetite || "\u2014"}
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Acquisition Timeline</div>
            <div className="text-sm text-muted-foreground">
              {buyer.acquisition_timeline || "\u2014"}
            </div>
          </div>
        </div>
      )}
    </BuyerDataSection>
  );
}
