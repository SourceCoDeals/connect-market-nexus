import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SizeCriteria, ServiceCriteria, GeographyCriteria } from "@/lib/ma-intelligence/types";

interface StructuredCriteriaPanelProps {
  trackerId: string;
  sizeCriteria: SizeCriteria | null;
  serviceCriteria: ServiceCriteria | null;
  geographyCriteria: GeographyCriteria | null;
  onSave: (criteria: {
    size_criteria?: SizeCriteria;
    service_criteria?: ServiceCriteria;
    geography_criteria?: GeographyCriteria;
  }) => void;
}

export function StructuredCriteriaPanel({
  trackerId,
  sizeCriteria,
  serviceCriteria,
  geographyCriteria,
  onSave,
}: StructuredCriteriaPanelProps) {
  const [size, setSize] = useState<SizeCriteria>(sizeCriteria || {});
  const [service, setService] = useState<ServiceCriteria>(serviceCriteria || {});
  const [geography, setGeography] = useState<GeographyCriteria>(geographyCriteria || {});
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    onSave({
      size_criteria: size,
      service_criteria: service,
      geography_criteria: geography,
    });
    setHasChanges(false);
  };

  const handleReset = () => {
    setSize(sizeCriteria || {});
    setService(serviceCriteria || {});
    setGeography(geographyCriteria || {});
    setHasChanges(false);
  };

  const updateSize = (updates: Partial<SizeCriteria>) => {
    setSize({ ...size, ...updates });
    setHasChanges(true);
  };

  const updateService = (updates: Partial<ServiceCriteria>) => {
    setService({ ...service, ...updates });
    setHasChanges(true);
  };

  const updateGeography = (updates: Partial<GeographyCriteria>) => {
    setGeography({ ...geography, ...updates });
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Structured Fit Criteria</CardTitle>
            <CardDescription>
              Define structured criteria for scoring and matching
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && <Badge variant="secondary">Unsaved changes</Badge>}
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="size" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="size">Size & Scale</TabsTrigger>
            <TabsTrigger value="service">Services</TabsTrigger>
            <TabsTrigger value="geography">Geography</TabsTrigger>
          </TabsList>

          <TabsContent value="size" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min-revenue">Minimum Revenue ($M)</Label>
                <Input
                  id="min-revenue"
                  type="number"
                  value={size.min_revenue || ""}
                  onChange={(e) => updateSize({ min_revenue: e.target.value })}
                  placeholder="e.g., 10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-revenue">Maximum Revenue ($M)</Label>
                <Input
                  id="max-revenue"
                  type="number"
                  value={size.max_revenue || ""}
                  onChange={(e) => updateSize({ max_revenue: e.target.value })}
                  placeholder="e.g., 100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ideal-revenue">Ideal Revenue ($M)</Label>
                <Input
                  id="ideal-revenue"
                  type="number"
                  value={size.ideal_revenue || ""}
                  onChange={(e) => updateSize({ ideal_revenue: e.target.value })}
                  placeholder="e.g., 50"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min-ebitda">Minimum EBITDA ($M)</Label>
                <Input
                  id="min-ebitda"
                  type="number"
                  value={size.min_ebitda || ""}
                  onChange={(e) => updateSize({ min_ebitda: e.target.value })}
                  placeholder="e.g., 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-ebitda">Maximum EBITDA ($M)</Label>
                <Input
                  id="max-ebitda"
                  type="number"
                  value={size.max_ebitda || ""}
                  onChange={(e) => updateSize({ max_ebitda: e.target.value })}
                  placeholder="e.g., 20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ideal-ebitda">Ideal EBITDA ($M)</Label>
                <Input
                  id="ideal-ebitda"
                  type="number"
                  value={size.ideal_ebitda || ""}
                  onChange={(e) => updateSize({ ideal_ebitda: e.target.value })}
                  placeholder="e.g., 10"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min-locations">Minimum Locations</Label>
                <Input
                  id="min-locations"
                  type="number"
                  value={size.min_locations || ""}
                  onChange={(e) => updateSize({ min_locations: e.target.value })}
                  placeholder="e.g., 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-locations">Maximum Locations</Label>
                <Input
                  id="max-locations"
                  type="number"
                  value={size.max_locations || ""}
                  onChange={(e) => updateSize({ max_locations: e.target.value })}
                  placeholder="e.g., 50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size-notes">Size Notes</Label>
              <Textarea
                id="size-notes"
                value={size.notes || ""}
                onChange={(e) => updateSize({ notes: e.target.value })}
                placeholder="Additional notes about size criteria..."
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="service" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="primary-focus">Primary Focus (comma-separated)</Label>
              <Input
                id="primary-focus"
                value={service.primary_focus?.join(", ") || ""}
                onChange={(e) => updateService({
                  primary_focus: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g., HVAC, Plumbing, Electrical"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary-services">Secondary Services (comma-separated)</Label>
              <Input
                id="secondary-services"
                value={service.secondary_services?.join(", ") || ""}
                onChange={(e) => updateService({
                  secondary_services: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g., General Contracting, Property Management"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excluded-services">Excluded Services (comma-separated)</Label>
              <Input
                id="excluded-services"
                value={service.excluded_services?.join(", ") || ""}
                onChange={(e) => updateService({
                  excluded_services: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g., Roofing, Landscaping"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-notes">Service Notes</Label>
              <Textarea
                id="service-notes"
                value={service.notes || ""}
                onChange={(e) => updateService({ notes: e.target.value })}
                placeholder="Additional notes about service criteria..."
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="geography" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="target-regions">Target Regions (comma-separated)</Label>
              <Input
                id="target-regions"
                value={geography.target_regions?.join(", ") || ""}
                onChange={(e) => updateGeography({
                  target_regions: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g., Northeast, Southeast, Midwest"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-states">Target States (comma-separated)</Label>
              <Input
                id="target-states"
                value={geography.target_states?.join(", ") || ""}
                onChange={(e) => updateGeography({
                  target_states: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g., CA, TX, FL, NY"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excluded-regions">Excluded Regions (comma-separated)</Label>
              <Input
                id="excluded-regions"
                value={geography.excluded_regions?.join(", ") || ""}
                onChange={(e) => updateGeography({
                  excluded_regions: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g., International"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="geographic-strategy">Geographic Strategy</Label>
              <Textarea
                id="geographic-strategy"
                value={geography.geographic_strategy || ""}
                onChange={(e) => updateGeography({ geographic_strategy: e.target.value })}
                placeholder="Describe the geographic expansion strategy..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="geography-notes">Geography Notes</Label>
              <Textarea
                id="geography-notes"
                value={geography.notes || ""}
                onChange={(e) => updateGeography({ notes: e.target.value })}
                placeholder="Additional notes about geography criteria..."
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium mb-1">AI-Assisted Criteria Editing</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Ask Claude to help refine your criteria based on deal characteristics or buyer preferences
              </p>
              <Button variant="outline" size="sm">
                <Sparkles className="w-4 h-4 mr-2" />
                Open AI Assistant
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
