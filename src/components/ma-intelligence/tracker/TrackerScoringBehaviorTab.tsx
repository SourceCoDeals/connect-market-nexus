import { ScoringBehaviorPanel } from "@/components/ma-intelligence/ScoringBehaviorPanel";
import type { ScoringBehavior } from "@/lib/ma-intelligence/types";

interface TrackerScoringBehaviorTabProps {
  trackerId: string;
  scoringBehavior: ScoringBehavior | null;
  onSave: (behavior: ScoringBehavior) => Promise<void>;
}

export function TrackerScoringBehaviorTab({
  trackerId,
  scoringBehavior,
  onSave,
}: TrackerScoringBehaviorTabProps) {
  return (
    <ScoringBehaviorPanel
      trackerId={trackerId}
      scoringBehavior={scoringBehavior}
      onSave={onSave}
    />
  );
}
