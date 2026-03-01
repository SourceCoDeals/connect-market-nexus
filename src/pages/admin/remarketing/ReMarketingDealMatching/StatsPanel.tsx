import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Target,
  AlertCircle,
  CheckCircle2,
  Check,
} from "lucide-react";
import { ScoringInsightsPanel } from "@/components/remarketing";

interface StatsPanelProps {
  stats: {
    qualified: number;
    disqualified: number;
    strong: number;
    approved: number;
    passed: number;
    total: number;
    disqualificationReason: string;
  };
  hideDisqualified: boolean;
  setHideDisqualified: (v: boolean) => void;
  linkedUniverses: Array<{
    id: string;
    name: string;
    geography_weight: number;
    size_weight: number;
    service_weight: number;
    owner_goals_weight: number;
  }> | undefined;
  selectedUniverse: string;
  customInstructions: string;
  setCustomInstructions: (v: string) => void;
  handleApplyAndRescore: (instructions: string) => Promise<void>;
  handleBulkScore: () => void;
  handleReset: () => Promise<void>;
  isScoring: boolean;
  geographyMode: 'critical' | 'preferred' | 'minimal';
  setGeographyMode: (v: 'critical' | 'preferred' | 'minimal') => void;
}

export function StatsPanel({
  stats,
  hideDisqualified,
  setHideDisqualified,
  linkedUniverses,
  selectedUniverse,
  customInstructions,
  setCustomInstructions,
  handleApplyAndRescore,
  handleBulkScore,
  handleReset,
  isScoring,
  geographyMode,
  setGeographyMode,
}: StatsPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Stats Summary Card */}
      <Card className="lg:col-span-1 bg-amber-50/50 border-amber-100">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">{stats.qualified} qualified buyers</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{stats.disqualified} disqualified{stats.disqualificationReason && ` (${stats.disqualificationReason})`}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-blue-500" />
            <span className="font-medium">{stats.strong} strong matches (&gt;80%)</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <Check className="h-4 w-4" />
            <span>{stats.approved} approved</span>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
            <Switch
              id="hide-disqualified"
              checked={hideDisqualified}
              onCheckedChange={setHideDisqualified}
            />
            <Label htmlFor="hide-disqualified" className="text-sm">
              Hide disqualified
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Right: Collapsible Scoring Insights Panel */}
      {linkedUniverses && linkedUniverses.length > 0 && (
        <div className="lg:col-span-2">
          <ScoringInsightsPanel
            universeId={selectedUniverse !== 'all' ? selectedUniverse : linkedUniverses[0]?.id}
            universeName={
              selectedUniverse === 'all'
                ? `${linkedUniverses.length} universes`
                : linkedUniverses?.find(u => u.id === selectedUniverse)?.name
            }
            weights={{
              geography: (selectedUniverse !== 'all'
                ? linkedUniverses?.find(u => u.id === selectedUniverse)?.geography_weight
                : linkedUniverses[0]?.geography_weight) || 20,
              size: (selectedUniverse !== 'all'
                ? linkedUniverses?.find(u => u.id === selectedUniverse)?.size_weight
                : linkedUniverses[0]?.size_weight) || 30,
              service: (selectedUniverse !== 'all'
                ? linkedUniverses?.find(u => u.id === selectedUniverse)?.service_weight
                : linkedUniverses[0]?.service_weight) || 45,
              ownerGoals: (selectedUniverse !== 'all'
                ? linkedUniverses?.find(u => u.id === selectedUniverse)?.owner_goals_weight
                : linkedUniverses[0]?.owner_goals_weight) || 5,
            }}
            outcomeStats={{
              approved: stats.approved,
              passed: stats.passed,
              removed: 0,
            }}
            decisionCount={stats.approved + stats.passed}
            isWeightsAdjusted={!!customInstructions}
            customInstructions={customInstructions}
            onInstructionsChange={setCustomInstructions}
            onApplyAndRescore={handleApplyAndRescore}
            onRecalculate={() => handleBulkScore()}
            onReset={handleReset}
            isRecalculating={isScoring}
            geographyMode={geographyMode}
            onGeographyModeChange={setGeographyMode}
          />
        </div>
      )}
    </div>
  );
}
