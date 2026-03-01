import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
} from "lucide-react";
import { ScoringProgressIndicator } from "@/components/remarketing";

interface ScoringControlsProps {
  selectedUniverse: string;
  setSelectedUniverse: (v: string) => void;
  linkedUniverses: Array<{ id: string; name: string }> | undefined;
  universeMatchCounts: Record<string, number>;
  isScoring: boolean;
  scoringProgress: number;
  backgroundScoring: {
    isScoring: boolean;
    currentCount: number;
    expectedCount: number;
    progress: number;
  };
  handleBulkScore: () => void;
}

export function ScoringControls({
  selectedUniverse,
  setSelectedUniverse,
  linkedUniverses,
  universeMatchCounts,
  isScoring,
  scoringProgress,
  backgroundScoring,
  handleBulkScore,
}: ScoringControlsProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Universe Filter Dropdown */}
          <div className="flex-1 min-w-[250px]">
            <Select value={selectedUniverse} onValueChange={setSelectedUniverse}>
              <SelectTrigger>
                <SelectValue placeholder="Select a universe" />
              </SelectTrigger>
              <SelectContent>
                {linkedUniverses?.map((universe) => (
                  <SelectItem key={universe.id} value={universe.id}>
                    {universe.name} ({universeMatchCounts[universe.id] || 0} matches)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => handleBulkScore()}
            disabled={!selectedUniverse || selectedUniverse === 'all' || isScoring}
          >
            {isScoring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scoring...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Score Buyers
              </>
            )}
          </Button>
        </div>

        {(isScoring || backgroundScoring.isScoring) && (
          <div className="mt-4">
            <ScoringProgressIndicator
              currentCount={backgroundScoring.currentCount || Math.round(scoringProgress / 10)}
              expectedCount={backgroundScoring.expectedCount || 10}
              progress={backgroundScoring.progress || scoringProgress}
              universeName={linkedUniverses?.find(u => u.id === selectedUniverse)?.name}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
