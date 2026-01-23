import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChevronDown, 
  Settings2, 
  MapPin, 
  DollarSign, 
  Wrench,
  Users,
  RotateCcw,
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoringBehavior } from "@/types/remarketing";

interface ScoringBehaviorPanelEnhancedProps {
  scoringBehavior: ScoringBehavior;
  weights: {
    geography: number;
    size: number;
    service: number;
    ownerGoals: number;
  };
  onScoringBehaviorChange?: (behavior: ScoringBehavior) => void;
  onWeightsChange?: (weights: { geography: number; size: number; service: number; ownerGoals: number }) => void;
  onSave?: () => void;
  readOnly?: boolean;
}

const INDUSTRY_PRESETS: Record<string, Partial<ScoringBehavior>> = {
  collision_repair: {
    geography_strictness: 'moderate',
    single_location_matching: 'adjacent_states',
    multi_location_matching: 'same_region',
    allow_national_buyers: true,
    size_strictness: 'moderate',
    below_minimum_handling: 'penalize',
    penalize_single_location: false,
    service_matching_mode: 'keyword',
    require_primary_focus: true,
    excluded_services_dealbreaker: true,
    can_override_geography: true,
    can_override_size: false,
    engagement_weight_multiplier: 1.0,
  },
  software: {
    geography_strictness: 'flexible',
    single_location_matching: 'same_region',
    multi_location_matching: 'national',
    allow_national_buyers: true,
    size_strictness: 'strict',
    below_minimum_handling: 'disqualify',
    penalize_single_location: false,
    service_matching_mode: 'semantic',
    require_primary_focus: true,
    excluded_services_dealbreaker: false,
    can_override_geography: true,
    can_override_size: true,
    engagement_weight_multiplier: 1.5,
  },
  hvac: {
    geography_strictness: 'strict',
    single_location_matching: 'exact_state',
    multi_location_matching: 'same_region',
    allow_national_buyers: false,
    size_strictness: 'moderate',
    below_minimum_handling: 'penalize',
    penalize_single_location: true,
    service_matching_mode: 'keyword',
    require_primary_focus: true,
    excluded_services_dealbreaker: true,
    can_override_geography: false,
    can_override_size: true,
    engagement_weight_multiplier: 1.0,
  },
  pest_control: {
    geography_strictness: 'moderate',
    single_location_matching: 'adjacent_states',
    multi_location_matching: 'same_region',
    allow_national_buyers: true,
    size_strictness: 'flexible',
    below_minimum_handling: 'allow',
    penalize_single_location: false,
    service_matching_mode: 'keyword',
    require_primary_focus: false,
    excluded_services_dealbreaker: true,
    can_override_geography: true,
    can_override_size: true,
    engagement_weight_multiplier: 1.25,
  },
};

const DEFAULT_BEHAVIOR: ScoringBehavior = {
  boost_adjacency: true,
  penalize_distance: true,
  require_thesis_match: false,
  minimum_data_completeness: 'low',
  industry_preset: 'custom',
  geography_strictness: 'moderate',
  single_location_matching: 'adjacent_states',
  multi_location_matching: 'same_region',
  allow_national_buyers: true,
  size_strictness: 'moderate',
  below_minimum_handling: 'penalize',
  penalize_single_location: false,
  service_matching_mode: 'keyword',
  require_primary_focus: false,
  excluded_services_dealbreaker: false,
  can_override_geography: true,
  can_override_size: false,
  engagement_weight_multiplier: 1.0,
};

export const ScoringBehaviorPanelEnhanced = ({
  scoringBehavior,
  weights,
  onScoringBehaviorChange,
  onWeightsChange,
  onSave,
  readOnly = false,
}: ScoringBehaviorPanelEnhancedProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const totalWeight = weights.geography + weights.size + weights.service + weights.ownerGoals;

  const handleChange = <K extends keyof ScoringBehavior>(key: K, value: ScoringBehavior[K]) => {
    if (onScoringBehaviorChange && !readOnly) {
      onScoringBehaviorChange({ ...scoringBehavior, [key]: value, industry_preset: 'custom' });
    }
  };

  const applyPreset = (preset: string) => {
    if (onScoringBehaviorChange && !readOnly && preset in INDUSTRY_PRESETS) {
      onScoringBehaviorChange({
        ...scoringBehavior,
        ...INDUSTRY_PRESETS[preset],
        industry_preset: preset as ScoringBehavior['industry_preset'],
      });
    }
  };

  const resetToDefaults = () => {
    if (onScoringBehaviorChange && !readOnly) {
      onScoringBehaviorChange(DEFAULT_BEHAVIOR);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Settings2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Scoring Behavior Configuration</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {scoringBehavior.industry_preset && scoringBehavior.industry_preset !== 'custom' 
                      ? `Using ${scoringBehavior.industry_preset.replace('_', ' ')} preset`
                      : 'Custom configuration'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    {weights.geography}%
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <DollarSign className="h-3 w-3 mr-1" />
                    {weights.size}%
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Wrench className="h-3 w-3 mr-1" />
                    {weights.service}%
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {weights.ownerGoals}%
                  </Badge>
                </div>
                <Badge variant={totalWeight === 100 ? "default" : "destructive"} className="text-xs">
                  Total: {totalWeight}%
                </Badge>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Industry Preset Tabs */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Industry Preset</Label>
              <Tabs 
                value={scoringBehavior.industry_preset || 'custom'} 
                onValueChange={applyPreset}
                className="w-full"
              >
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="collision_repair" disabled={readOnly}>Collision Repair</TabsTrigger>
                  <TabsTrigger value="software" disabled={readOnly}>Software</TabsTrigger>
                  <TabsTrigger value="hvac" disabled={readOnly}>HVAC</TabsTrigger>
                  <TabsTrigger value="pest_control" disabled={readOnly}>Pest Control</TabsTrigger>
                  <TabsTrigger value="custom" disabled={readOnly}>Custom</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Geography Scoring */}
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    Geography Scoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Strictness Level</Label>
                    <Select
                      value={scoringBehavior.geography_strictness || 'moderate'}
                      onValueChange={(v) => handleChange('geography_strictness', v as ScoringBehavior['geography_strictness'])}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strict">Strict - Exact match required</SelectItem>
                        <SelectItem value="moderate">Moderate - Adjacent states OK</SelectItem>
                        <SelectItem value="flexible">Flexible - Same region OK</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Single-Location Deals</Label>
                    <Select
                      value={scoringBehavior.single_location_matching || 'adjacent_states'}
                      onValueChange={(v) => handleChange('single_location_matching', v as ScoringBehavior['single_location_matching'])}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exact_state">Exact State Only</SelectItem>
                        <SelectItem value="adjacent_states">Include Adjacent States</SelectItem>
                        <SelectItem value="same_region">Same Region</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Multi-Location Deals (3+)</Label>
                    <Select
                      value={scoringBehavior.multi_location_matching || 'same_region'}
                      onValueChange={(v) => handleChange('multi_location_matching', v as ScoringBehavior['multi_location_matching'])}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same_region">Same Region</SelectItem>
                        <SelectItem value="national">National Footprint</SelectItem>
                        <SelectItem value="any">Any Geographic Match</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Allow national buyers</Label>
                    <Switch
                      checked={scoringBehavior.allow_national_buyers ?? true}
                      onCheckedChange={(checked) => handleChange('allow_national_buyers', checked)}
                      disabled={readOnly}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Size/Revenue Scoring */}
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    Size/Revenue Scoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Strictness Level</Label>
                    <Select
                      value={scoringBehavior.size_strictness || 'moderate'}
                      onValueChange={(v) => handleChange('size_strictness', v as ScoringBehavior['size_strictness'])}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strict">Strict - Within exact range</SelectItem>
                        <SelectItem value="moderate">Moderate - ±25% tolerance</SelectItem>
                        <SelectItem value="flexible">Flexible - ±50% tolerance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">When deal is below buyer's minimum</Label>
                    <Select
                      value={scoringBehavior.below_minimum_handling || 'penalize'}
                      onValueChange={(v) => handleChange('below_minimum_handling', v as ScoringBehavior['below_minimum_handling'])}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disqualify">Disqualify Completely</SelectItem>
                        <SelectItem value="penalize">Penalize Score (-30%)</SelectItem>
                        <SelectItem value="allow">Allow with Warning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Penalize single-location deals</Label>
                    <Switch
                      checked={scoringBehavior.penalize_single_location ?? false}
                      onCheckedChange={(checked) => handleChange('penalize_single_location', checked)}
                      disabled={readOnly}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Service Matching */}
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-orange-500" />
                    Service Matching
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Matching Mode</Label>
                    <Select
                      value={scoringBehavior.service_matching_mode || 'keyword'}
                      onValueChange={(v) => handleChange('service_matching_mode', v as ScoringBehavior['service_matching_mode'])}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keyword">Keyword Matching</SelectItem>
                        <SelectItem value="semantic">Semantic AI-powered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Require primary focus match</Label>
                    <Switch
                      checked={scoringBehavior.require_primary_focus ?? false}
                      onCheckedChange={(checked) => handleChange('require_primary_focus', checked)}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Excluded services are dealbreakers</Label>
                    <Switch
                      checked={scoringBehavior.excluded_services_dealbreaker ?? false}
                      onCheckedChange={(checked) => handleChange('excluded_services_dealbreaker', checked)}
                      disabled={readOnly}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Engagement Overrides */}
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    Engagement Overrides
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Can override geography</Label>
                    <Switch
                      checked={scoringBehavior.can_override_geography ?? true}
                      onCheckedChange={(checked) => handleChange('can_override_geography', checked)}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Can override size</Label>
                    <Switch
                      checked={scoringBehavior.can_override_size ?? false}
                      onCheckedChange={(checked) => handleChange('can_override_size', checked)}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Engagement weight multiplier</Label>
                      <span className="text-sm font-medium">
                        {(scoringBehavior.engagement_weight_multiplier ?? 1.0).toFixed(2)}x
                      </span>
                    </div>
                    <Slider
                      value={[(scoringBehavior.engagement_weight_multiplier ?? 1.0) * 100]}
                      min={50}
                      max={200}
                      step={25}
                      onValueChange={([v]) => handleChange('engagement_weight_multiplier', v / 100)}
                      disabled={readOnly}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0.5x</span>
                      <span>1.0x</span>
                      <span>1.5x</span>
                      <span>2.0x</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            {!readOnly && (
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={resetToDefaults}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to defaults
                </Button>
                {onSave && (
                  <Button onClick={onSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Configuration
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default ScoringBehaviorPanelEnhanced;
