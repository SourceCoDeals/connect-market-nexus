import { ScoringBehaviorPanel } from "@/components/ma-intelligence/ScoringBehaviorPanel";

interface ScoringWeights {
  geography_weight?: number;
  service_mix_weight?: number;
  size_weight?: number;
  owner_goals_weight?: number;
}

interface TrackerScoringBehaviorTabProps {
  trackerId: string;
  scoringBehavior: Record<string, unknown> | null;
  onSave?: () => void;
}

export function TrackerScoringBehaviorTab({
  trackerId,
  scoringBehavior,
  onSave,
}: TrackerScoringBehaviorTabProps) {
  const weights = scoringBehavior as ScoringWeights | null;
  return (
    <ScoringBehaviorPanel
      trackerId={trackerId}
      tracker={{
        geography_weight: weights?.geography_weight ?? 1.0,
        service_mix_weight: weights?.service_mix_weight ?? 1.0,
        size_weight: weights?.size_weight ?? 1.0,
        owner_goals_weight: weights?.owner_goals_weight ?? 1.0,
      }}
      onSave={onSave}
    />
  );
}
