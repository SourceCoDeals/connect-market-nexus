import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings2, ChevronDown, Sparkles, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoringBehavior } from "@/types/remarketing";

interface ScoringStyleCardProps {
  scoringBehavior: ScoringBehavior;
  onScoringBehaviorChange: (behavior: ScoringBehavior) => void;
  onStartAIResearch?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export const ScoringStyleCard = ({
  scoringBehavior,
  onScoringBehaviorChange,
  onStartAIResearch,
  onSave,
  isSaving = false,
}: ScoringStyleCardProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Derive overall strictness from individual settings
  const getOverallStrictness = (): 'flexible' | 'moderate' | 'strict' => {
    const geoStrict = scoringBehavior.geography_strictness || 'moderate';
    const sizeStrict = scoringBehavior.size_strictness || 'moderate';
    if (geoStrict === 'strict' || sizeStrict === 'strict') return 'strict';
    if (geoStrict === 'flexible' && sizeStrict === 'flexible') return 'flexible';
    return 'moderate';
  };

  const handleStrictnessChange = (value: 'flexible' | 'moderate' | 'strict') => {
    onScoringBehaviorChange({
      ...scoringBehavior,
      geography_strictness: value,
      size_strictness: value,
      industry_preset: 'custom',
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Industry & Scoring Style</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Select an industry preset or run AI Research to auto-configure
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSave && (
              <Button size="sm" onClick={onSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Strictness Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Match Strictness</Label>
          <RadioGroup
            value={getOverallStrictness()}
            onValueChange={(v) => handleStrictnessChange(v as 'flexible' | 'moderate' | 'strict')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="flexible" id="flexible" />
              <Label htmlFor="flexible" className="text-sm cursor-pointer">
                Flexible
                <span className="text-xs text-muted-foreground ml-1">— More matches</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="moderate" id="moderate" />
              <Label htmlFor="moderate" className="text-sm cursor-pointer">
                Moderate
                <span className="text-xs text-muted-foreground ml-1">— Balanced</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="strict" id="strict" />
              <Label htmlFor="strict" className="text-sm cursor-pointer">
                Strict
                <span className="text-xs text-muted-foreground ml-1">— Fewer, better matches</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* AI Research CTA */}
        {onStartAIResearch && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
            <div>
              <p className="text-sm font-medium">Auto-populate criteria with AI Research</p>
              <p className="text-xs text-muted-foreground">
                Generates industry-specific buyer profiles and match criteria
              </p>
            </div>
            <Button variant="default" size="sm" onClick={onStartAIResearch}>
              <Sparkles className="h-4 w-4 mr-1" />
              Run AI Research
            </Button>
          </div>
        )}

        {/* Advanced Settings Toggle */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
              {showAdvanced ? 'Hide' : 'Show'} advanced settings
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="text-sm">
                <span className="text-muted-foreground">Geography:</span>
                <Badge variant="outline" className="ml-2 capitalize">
                  {scoringBehavior.geography_strictness || 'moderate'}
                </Badge>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Size:</span>
                <Badge variant="outline" className="ml-2 capitalize">
                  {scoringBehavior.size_strictness || 'moderate'}
                </Badge>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Service matching:</span>
                <Badge variant="outline" className="ml-2 capitalize">
                  {scoringBehavior.service_matching_mode || 'keyword'}
                </Badge>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Below minimum:</span>
                <Badge variant="outline" className="ml-2 capitalize">
                  {scoringBehavior.below_minimum_handling || 'penalize'}
                </Badge>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Primary focus required:</span>
                <Badge variant={scoringBehavior.require_primary_focus ? "default" : "secondary"} className="ml-2">
                  {scoringBehavior.require_primary_focus ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Allow national buyers:</span>
                <Badge variant={scoringBehavior.allow_national_buyers ? "default" : "secondary"} className="ml-2">
                  {scoringBehavior.allow_national_buyers ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default ScoringStyleCard;
