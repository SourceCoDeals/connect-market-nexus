import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChipInput } from "@/components/ui/chip-input";
import { Sparkles, Save, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";

interface StructuredCriteriaPanelProps {
  trackerId: string;
  tracker: {
    size_criteria?: any;
    service_criteria?: any;
    geography_criteria?: any;
    buyer_types_criteria?: any;
  };
  onSave?: () => void;
}

export function StructuredCriteriaPanel({
  trackerId,
  tracker,
  onSave,
}: StructuredCriteriaPanelProps) {
  const [sizeCriteria, setSizeCriteria] = useState(tracker.size_criteria || {
    min_revenue: "",
    max_revenue: "",
    min_ebitda: "",
    max_ebitda: "",
    min_employees: "",
    max_employees: "",
  });

  const [serviceCriteria, setServiceCriteria] = useState(tracker.service_criteria || {
    primary_focus: "",
    target_services: [],
    service_exclusions: [],
  });

  const [geographyCriteria, setGeographyCriteria] = useState(tracker.geography_criteria || {
    target_geographies: [],
    geographic_exclusions: [],
    national_keywords: [],
  });

  const [buyerTypesCriteria, setBuyerTypesCriteria] = useState(tracker.buyer_types_criteria || {
    addon_only: false,
    platform_only: false,
    other_preferences: "",
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | 'pending' | null>(null);
  const { toast } = useToast();

  const validateCriteria = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("validate-criteria", {
        body: {
          tracker_id: trackerId,
          size_criteria: sizeCriteria,
          service_criteria: serviceCriteria,
          geography_criteria: geographyCriteria,
          buyer_types_criteria: buyerTypesCriteria,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setValidationStatus(data.valid ? 'valid' : 'invalid');
      if (!data.valid) {
        toast({
          title: "Validation Issues",
          description: data.message || "Some criteria may need adjustment",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setValidationStatus('invalid');
      toast({
        title: "Validation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('industry_trackers')
        .update({
          size_criteria: sizeCriteria,
          service_criteria: serviceCriteria,
          geography_criteria: geographyCriteria,
          buyer_types_criteria: buyerTypesCriteria,
        })
        .eq('id', trackerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Criteria saved successfully",
      });

      setHasChanges(false);
      setIsEditMode(false);
      onSave?.();

      // Validate after save
      validateCriteria.mutate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setSizeCriteria(tracker.size_criteria || {});
    setServiceCriteria(tracker.service_criteria || {});
    setGeographyCriteria(tracker.geography_criteria || {});
    setBuyerTypesCriteria(tracker.buyer_types_criteria || {});
    setHasChanges(false);
  };

  const markChanged = () => {
    setHasChanges(true);
    setValidationStatus(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle>Structured Fit Criteria</CardTitle>
            <CardDescription>
              Define structured criteria for scoring and matching
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {validationStatus === 'valid' && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Valid
              </Badge>
            )}
            {validationStatus === 'invalid' && (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Issues
              </Badge>
            )}
            {validateCriteria.isPending && (
              <Badge variant="secondary">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Validating...
              </Badge>
            )}
            {hasChanges && <Badge variant="secondary">Unsaved changes</Badge>}
            {!isEditMode && (
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                Edit
              </Button>
            )}
            {isEditMode && (
              <>
                <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="size" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="size">Size</TabsTrigger>
            <TabsTrigger value="service">Services</TabsTrigger>
            <TabsTrigger value="geography">Geography</TabsTrigger>
            <TabsTrigger value="buyer-types">Buyer Types</TabsTrigger>
          </TabsList>

          <TabsContent value="size" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min-revenue">Minimum Revenue ($M)</Label>
                <Input
                  id="min-revenue"
                  type="number"
                  value={sizeCriteria.min_revenue}
                  onChange={(e) => {
                    setSizeCriteria({ ...sizeCriteria, min_revenue: e.target.value });
                    markChanged();
                  }}
                  placeholder="e.g., 10"
                  disabled={!isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-revenue">Maximum Revenue ($M)</Label>
                <Input
                  id="max-revenue"
                  type="number"
                  value={sizeCriteria.max_revenue}
                  onChange={(e) => {
                    setSizeCriteria({ ...sizeCriteria, max_revenue: e.target.value });
                    markChanged();
                  }}
                  placeholder="e.g., 100"
                  disabled={!isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-ebitda">Minimum EBITDA ($M)</Label>
                <Input
                  id="min-ebitda"
                  type="number"
                  value={sizeCriteria.min_ebitda}
                  onChange={(e) => {
                    setSizeCriteria({ ...sizeCriteria, min_ebitda: e.target.value });
                    markChanged();
                  }}
                  placeholder="e.g., 2"
                  disabled={!isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-ebitda">Maximum EBITDA ($M)</Label>
                <Input
                  id="max-ebitda"
                  type="number"
                  value={sizeCriteria.max_ebitda}
                  onChange={(e) => {
                    setSizeCriteria({ ...sizeCriteria, max_ebitda: e.target.value });
                    markChanged();
                  }}
                  placeholder="e.g., 20"
                  disabled={!isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-employees">Minimum Employees</Label>
                <Input
                  id="min-employees"
                  type="number"
                  value={sizeCriteria.min_employees}
                  onChange={(e) => {
                    setSizeCriteria({ ...sizeCriteria, min_employees: e.target.value });
                    markChanged();
                  }}
                  placeholder="e.g., 50"
                  disabled={!isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-employees">Maximum Employees</Label>
                <Input
                  id="max-employees"
                  type="number"
                  value={sizeCriteria.max_employees}
                  onChange={(e) => {
                    setSizeCriteria({ ...sizeCriteria, max_employees: e.target.value });
                    markChanged();
                  }}
                  placeholder="e.g., 500"
                  disabled={!isEditMode}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="service" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="primary-focus">Primary Focus</Label>
              <Input
                id="primary-focus"
                value={serviceCriteria.primary_focus}
                onChange={(e) => {
                  setServiceCriteria({ ...serviceCriteria, primary_focus: e.target.value });
                  markChanged();
                }}
                placeholder="e.g., HVAC Services"
                disabled={!isEditMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-services">Target Services</Label>
              <ChipInput
                value={serviceCriteria.target_services || []}
                onChange={(value) => {
                  setServiceCriteria({ ...serviceCriteria, target_services: value });
                  markChanged();
                }}
                placeholder="Add service and press Enter..."
                disabled={!isEditMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-exclusions">Service Exclusions</Label>
              <ChipInput
                value={serviceCriteria.service_exclusions || []}
                onChange={(value) => {
                  setServiceCriteria({ ...serviceCriteria, service_exclusions: value });
                  markChanged();
                }}
                placeholder="Add exclusion and press Enter..."
                disabled={!isEditMode}
              />
            </div>
          </TabsContent>

          <TabsContent value="geography" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="target-geographies">Target Geographies</Label>
              <ChipInput
                value={geographyCriteria.target_geographies || []}
                onChange={(value) => {
                  setGeographyCriteria({ ...geographyCriteria, target_geographies: value });
                  markChanged();
                }}
                placeholder="Add state/region and press Enter... (e.g., CA, TX, Northeast)"
                disabled={!isEditMode}
              />
              <p className="text-xs text-muted-foreground">
                Enter state codes (e.g., CA, TX) or region names (e.g., Northeast, Southeast)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="geographic-exclusions">Geographic Exclusions</Label>
              <ChipInput
                value={geographyCriteria.geographic_exclusions || []}
                onChange={(value) => {
                  setGeographyCriteria({ ...geographyCriteria, geographic_exclusions: value });
                  markChanged();
                }}
                placeholder="Add exclusion and press Enter..."
                disabled={!isEditMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="national-keywords">National Keywords</Label>
              <ChipInput
                value={geographyCriteria.national_keywords || []}
                onChange={(value) => {
                  setGeographyCriteria({ ...geographyCriteria, national_keywords: value });
                  markChanged();
                }}
                placeholder="Add keyword and press Enter..."
                disabled={!isEditMode}
              />
              <p className="text-xs text-muted-foreground">
                Keywords indicating national coverage (e.g., "nationwide", "national", "all states")
              </p>
            </div>
          </TabsContent>

          <TabsContent value="buyer-types" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="addon-only"
                  checked={buyerTypesCriteria.addon_only}
                  onCheckedChange={(checked) => {
                    setBuyerTypesCriteria({ ...buyerTypesCriteria, addon_only: checked });
                    markChanged();
                  }}
                  disabled={!isEditMode}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="addon-only"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Add-on acquisitions only
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only match buyers looking for add-on acquisitions
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="platform-only"
                  checked={buyerTypesCriteria.platform_only}
                  onCheckedChange={(checked) => {
                    setBuyerTypesCriteria({ ...buyerTypesCriteria, platform_only: checked });
                    markChanged();
                  }}
                  disabled={!isEditMode}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="platform-only"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Platform acquisitions only
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only match buyers looking for platform/first acquisitions
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="other-preferences">Other Preferences</Label>
                <Textarea
                  id="other-preferences"
                  value={buyerTypesCriteria.other_preferences}
                  onChange={(e) => {
                    setBuyerTypesCriteria({ ...buyerTypesCriteria, other_preferences: e.target.value });
                    markChanged();
                  }}
                  placeholder="Additional buyer type preferences..."
                  rows={4}
                  disabled={!isEditMode}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium mb-1">AI-Assisted Criteria Editing</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Get AI-powered suggestions to refine your criteria based on deal characteristics and buyer preferences
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast({
                    title: "AI Assistant",
                    description: "AI-powered criteria suggestions coming soon!",
                  });
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Suggest Improvements
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
