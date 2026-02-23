import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Archive, Trash2 } from "lucide-react";
import type { MADeal } from "@/lib/ma-intelligence/types";
import type { ScoringAdjustmentsState } from "./types";

interface DealDetailSidebarInternalProps {
  deal: MADeal;
  scoringState: ScoringAdjustmentsState;
  onSetScoringState: (state: Partial<ScoringAdjustmentsState>) => void;
  onSaveScoringAdjustments: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function DealDetailSidebar({
  deal,
  scoringState,
  onSetScoringState,
  onSaveScoringAdjustments,
  onArchive,
  onDelete,
}: DealDetailSidebarInternalProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Scoring Adjustments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Geography Weight Multiplier</Label>
                <span className="text-sm font-medium">{scoringState.geoWeightMultiplier}x</span>
              </div>
              <Slider
                min={0.5}
                max={2.0}
                step={0.1}
                value={[scoringState.geoWeightMultiplier]}
                onValueChange={([value]) => onSetScoringState({ geoWeightMultiplier: value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Size Weight Multiplier</Label>
                <span className="text-sm font-medium">{scoringState.sizeWeightMultiplier}x</span>
              </div>
              <Slider
                min={0.5}
                max={2.0}
                step={0.1}
                value={[scoringState.sizeWeightMultiplier]}
                onValueChange={([value]) => onSetScoringState({ sizeWeightMultiplier: value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Service Weight Multiplier</Label>
                <span className="text-sm font-medium">{scoringState.serviceWeightMultiplier}x</span>
              </div>
              <Slider
                min={0.5}
                max={2.0}
                step={0.1}
                value={[scoringState.serviceWeightMultiplier]}
                onValueChange={([value]) => onSetScoringState({ serviceWeightMultiplier: value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Custom Scoring Instructions</Label>
              <Textarea
                value={scoringState.customScoringInstructions}
                onChange={(e) => onSetScoringState({ customScoringInstructions: e.target.value })}
                rows={4}
                placeholder="Add any custom instructions for scoring this deal..."
              />
            </div>

            <Button onClick={onSaveScoringAdjustments}>
              Save Scoring Adjustments
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Extraction Sources</div>
              {deal.extraction_sources && Object.keys(deal.extraction_sources).length > 0 ? (
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(deal.extraction_sources, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No extraction sources available</p>
              )}
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Last Enriched</div>
              <div className="text-sm text-muted-foreground">
                {deal.last_enriched_at ? new Date(deal.last_enriched_at).toLocaleString() : "Never"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dangerous Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Archive Deal
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Deal
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
