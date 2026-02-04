import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ScoringBehaviorPanelProps {
  trackerId: string;
  tracker: {
    geography_weight?: number;
    service_mix_weight?: number;
    size_weight?: number;
    owner_goals_weight?: number;
  };
  onSave?: () => void;
}

const DEFAULT_WEIGHTS = {
  geography_weight: 1.0,
  service_mix_weight: 1.0,
  size_weight: 1.0,
  owner_goals_weight: 1.0,
};

export function ScoringBehaviorPanel({
  trackerId,
  tracker,
  onSave,
}: ScoringBehaviorPanelProps) {
  const [weights, setWeights] = useState({
    geography_weight: tracker.geography_weight ?? DEFAULT_WEIGHTS.geography_weight,
    service_mix_weight: tracker.service_mix_weight ?? DEFAULT_WEIGHTS.service_mix_weight,
    size_weight: tracker.size_weight ?? DEFAULT_WEIGHTS.size_weight,
    owner_goals_weight: tracker.owner_goals_weight ?? DEFAULT_WEIGHTS.owner_goals_weight,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('industry_trackers')
        .update(weights)
        .eq('id', trackerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Scoring weights saved successfully",
      });

      setHasChanges(false);
      onSave?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setWeights({
      geography_weight: tracker.geography_weight ?? DEFAULT_WEIGHTS.geography_weight,
      service_mix_weight: tracker.service_mix_weight ?? DEFAULT_WEIGHTS.service_mix_weight,
      size_weight: tracker.size_weight ?? DEFAULT_WEIGHTS.size_weight,
      owner_goals_weight: tracker.owner_goals_weight ?? DEFAULT_WEIGHTS.owner_goals_weight,
    });
    setHasChanges(false);
  };

  const handleResetToDefaults = () => {
    setWeights(DEFAULT_WEIGHTS);
    setHasChanges(true);
  };

  const updateWeight = (key: keyof typeof weights, value: number) => {
    setWeights({ ...weights, [key]: value });
    setHasChanges(true);
  };

  const getStrictnessLabel = (value: number): string => {
    if (value < 0.75) return "Very Lenient";
    if (value < 1.0) return "Lenient";
    if (value === 1.0) return "Standard";
    if (value < 1.5) return "Strict";
    return "Very Strict";
  };

  const getWeightColor = (value: number): string => {
    if (value < 0.75) return "text-blue-600";
    if (value < 1.0) return "text-green-600";
    if (value === 1.0) return "text-gray-600";
    if (value < 1.5) return "text-orange-600";
    return "text-red-600";
  };

  // Calculate expected score distribution preview
  const calculateScoreDistribution = () => {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return {
      geography: Math.round((weights.geography_weight / total) * 100),
      serviceMix: Math.round((weights.service_mix_weight / total) * 100),
      size: Math.round((weights.size_weight / total) * 100),
      ownerGoals: Math.round((weights.owner_goals_weight / total) * 100),
    };
  };

  const distribution = calculateScoreDistribution();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Scoring Behavior & Weights</CardTitle>
            <CardDescription>
              Configure how strictly each criterion is evaluated and weighted
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && <Badge variant="secondary">Unsaved changes</Badge>}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefaults}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Geography Weight */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Geography Strictness</Label>
              <p className="text-sm text-muted-foreground mt-1">
                How strictly should geographic preferences be matched?
              </p>
            </div>
            <Badge variant="outline" className={getWeightColor(weights.geography_weight)}>
              {weights.geography_weight.toFixed(1)}x - {getStrictnessLabel(weights.geography_weight)}
            </Badge>
          </div>
          <div className="space-y-2">
            <Slider
              value={[weights.geography_weight]}
              onValueChange={([value]) => updateWeight('geography_weight', value)}
              min={0.5}
              max={2.0}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5 (More lenient)</span>
              <span>1.0 (Standard)</span>
              <span>2.0 (Stricter)</span>
            </div>
          </div>
        </div>

        {/* Size Weight */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Size Strictness</Label>
              <p className="text-sm text-muted-foreground mt-1">
                How strictly should size criteria be matched?
              </p>
            </div>
            <Badge variant="outline" className={getWeightColor(weights.size_weight)}>
              {weights.size_weight.toFixed(1)}x - {getStrictnessLabel(weights.size_weight)}
            </Badge>
          </div>
          <div className="space-y-2">
            <Slider
              value={[weights.size_weight]}
              onValueChange={([value]) => updateWeight('size_weight', value)}
              min={0.5}
              max={2.0}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5 (More lenient)</span>
              <span>1.0 (Standard)</span>
              <span>2.0 (Stricter)</span>
            </div>
          </div>
        </div>

        {/* Service Mix Weight */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Service Mix Strictness</Label>
              <p className="text-sm text-muted-foreground mt-1">
                How strictly should service alignment be matched?
              </p>
            </div>
            <Badge variant="outline" className={getWeightColor(weights.service_mix_weight)}>
              {weights.service_mix_weight.toFixed(1)}x - {getStrictnessLabel(weights.service_mix_weight)}
            </Badge>
          </div>
          <div className="space-y-2">
            <Slider
              value={[weights.service_mix_weight]}
              onValueChange={([value]) => updateWeight('service_mix_weight', value)}
              min={0.5}
              max={2.0}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5 (More lenient)</span>
              <span>1.0 (Standard)</span>
              <span>2.0 (Stricter)</span>
            </div>
          </div>
        </div>

        {/* Owner Goals Weight */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Owner Goals Importance</Label>
              <p className="text-sm text-muted-foreground mt-1">
                How important are owner transition goals?
              </p>
            </div>
            <Badge variant="outline" className={getWeightColor(weights.owner_goals_weight)}>
              {weights.owner_goals_weight.toFixed(1)}x - {getStrictnessLabel(weights.owner_goals_weight)}
            </Badge>
          </div>
          <div className="space-y-2">
            <Slider
              value={[weights.owner_goals_weight]}
              onValueChange={([value]) => updateWeight('owner_goals_weight', value)}
              min={0}
              max={2.0}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.0 (Ignore)</span>
              <span>1.0 (Standard)</span>
              <span>2.0 (Critical)</span>
            </div>
          </div>
        </div>

        {/* Score Distribution Preview */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium mb-3">Expected Score Distribution</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Based on current weights, here's how each criterion will contribute to the composite score:
              </p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Geography</span>
                    <span className="font-medium">{distribution.geography}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${distribution.geography}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Service Mix</span>
                    <span className="font-medium">{distribution.serviceMix}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${distribution.serviceMix}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Size</span>
                    <span className="font-medium">{distribution.size}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full transition-all"
                      style={{ width: `${distribution.size}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Owner Goals</span>
                    <span className="font-medium">{distribution.ownerGoals}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${distribution.ownerGoals}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Higher weights will amplify both positive and negative scores for that criterion.
                Lower weights will have less impact on the final composite score.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
