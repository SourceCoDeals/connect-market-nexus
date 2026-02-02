import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw } from "lucide-react";
import type { ScoringBehavior } from "@/lib/ma-intelligence/types";

interface ScoringBehaviorPanelProps {
  trackerId: string;
  scoringBehavior: ScoringBehavior | null;
  onSave: (behavior: ScoringBehavior) => void;
}

export function ScoringBehaviorPanel({
  trackerId,
  scoringBehavior,
  onSave,
}: ScoringBehaviorPanelProps) {
  const [behavior, setBehavior] = useState<ScoringBehavior>(scoringBehavior || {
    size: { strictness: 'moderate', below_minimum_behavior: 'penalize', single_location_penalty: true },
    services: { matching_mode: 'semantic', require_primary_focus_match: false, excluded_services_are_dealbreakers: true },
    geography: { strictness: 'moderate', proximity_miles: 100, multi_location_rule: 'regional', single_location_rule: 'same_state', allow_national_for_attractive_deals: true },
    engagement: { weight_multiplier: 1.5, override_geography: false, override_size: false },
  });
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = () => {
    onSave(behavior);
    setHasChanges(false);
  };

  const handleReset = () => {
    setBehavior(scoringBehavior || behavior);
    setHasChanges(false);
  };

  const updateBehavior = (updates: Partial<ScoringBehavior>) => {
    setBehavior({ ...behavior, ...updates });
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Scoring Behavior</CardTitle>
            <CardDescription>
              Configure how the v6.1 scoring algorithm evaluates deals
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
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Size Scoring */}
        <div className="space-y-4">
          <h3 className="font-medium">Size & Scale Scoring</h3>
          <div className="space-y-3 pl-4 border-l-2">
            <div className="space-y-2">
              <Label>Strictness Level</Label>
              <RadioGroup
                value={behavior.size?.strictness || 'moderate'}
                onValueChange={(value) => updateBehavior({
                  size: { ...behavior.size!, strictness: value as any }
                })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="strict" id="size-strict" />
                  <Label htmlFor="size-strict">Strict - Heavy penalties outside range</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderate" id="size-moderate" />
                  <Label htmlFor="size-moderate">Moderate - Gradual score reduction</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lenient" id="size-lenient" />
                  <Label htmlFor="size-lenient">Lenient - Minimal penalties</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Below Minimum Behavior</Label>
              <RadioGroup
                value={behavior.size?.below_minimum_behavior || 'penalize'}
                onValueChange={(value) => updateBehavior({
                  size: { ...behavior.size!, below_minimum_behavior: value as any }
                })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disqualify" id="size-disqualify" />
                  <Label htmlFor="size-disqualify">Disqualify - Score = 0</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="penalize" id="size-penalize" />
                  <Label htmlFor="size-penalize">Penalize - Reduce score proportionally</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="single-location-penalty">Penalize single-location deals</Label>
              <Switch
                id="single-location-penalty"
                checked={behavior.size?.single_location_penalty || false}
                onCheckedChange={(checked) => updateBehavior({
                  size: { ...behavior.size!, single_location_penalty: checked }
                })}
              />
            </div>
          </div>
        </div>

        {/* Service Scoring */}
        <div className="space-y-4">
          <h3 className="font-medium">Service Matching</h3>
          <div className="space-y-3 pl-4 border-l-2">
            <div className="space-y-2">
              <Label>Matching Mode</Label>
              <RadioGroup
                value={behavior.services?.matching_mode || 'semantic'}
                onValueChange={(value) => updateBehavior({
                  services: { ...behavior.services!, matching_mode: value as any }
                })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="exact" id="service-exact" />
                  <Label htmlFor="service-exact">Exact - Keyword matching only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="semantic" id="service-semantic" />
                  <Label htmlFor="service-semantic">Semantic - AI-powered similarity</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="require-primary">Require primary focus match</Label>
              <Switch
                id="require-primary"
                checked={behavior.services?.require_primary_focus_match || false}
                onCheckedChange={(checked) => updateBehavior({
                  services: { ...behavior.services!, require_primary_focus_match: checked }
                })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="excluded-dealbreakers">Excluded services are dealbreakers</Label>
              <Switch
                id="excluded-dealbreakers"
                checked={behavior.services?.excluded_services_are_dealbreakers || false}
                onCheckedChange={(checked) => updateBehavior({
                  services: { ...behavior.services!, excluded_services_are_dealbreakers: checked }
                })}
              />
            </div>
          </div>
        </div>

        {/* Geography Scoring */}
        <div className="space-y-4">
          <h3 className="font-medium">Geographic Matching</h3>
          <div className="space-y-3 pl-4 border-l-2">
            <div className="space-y-2">
              <Label>Strictness Level</Label>
              <RadioGroup
                value={behavior.geography?.strictness || 'moderate'}
                onValueChange={(value) => updateBehavior({
                  geography: { ...behavior.geography!, strictness: value as any }
                })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="strict" id="geo-strict" />
                  <Label htmlFor="geo-strict">Strict - Must be in target areas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderate" id="geo-moderate" />
                  <Label htmlFor="geo-moderate">Moderate - Proximity-based scoring</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lenient" id="geo-lenient" />
                  <Label htmlFor="geo-lenient">Lenient - National buyers considered</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="allow-national">Allow national buyers for attractive deals</Label>
              <Switch
                id="allow-national"
                checked={behavior.geography?.allow_national_for_attractive_deals || false}
                onCheckedChange={(checked) => updateBehavior({
                  geography: { ...behavior.geography!, allow_national_for_attractive_deals: checked }
                })}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
