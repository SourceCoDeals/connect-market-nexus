import { ScoringBehaviorPanel } from "@/components/ma-intelligence/ScoringBehaviorPanel";

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
  return (
    <ScoringBehaviorPanel
      trackerId={trackerId}
      tracker={{
        geography_weight: (scoringBehavior as any)?.geography_weight ?? 1.0,
        service_mix_weight: (scoringBehavior as any)?.service_mix_weight ?? 1.0,
        size_weight: (scoringBehavior as any)?.size_weight ?? 1.0,
        owner_goals_weight: (scoringBehavior as any)?.owner_goals_weight ?? 1.0,
      }}
      onSave={onSave}
    />
  );
}
