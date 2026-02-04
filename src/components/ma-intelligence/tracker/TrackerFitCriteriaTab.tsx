import { StructuredCriteriaPanel } from "@/components/ma-intelligence/StructuredCriteriaPanel";
import type { SizeCriteria, ServiceCriteria, GeographyCriteria } from "@/lib/ma-intelligence/types";

interface TrackerFitCriteriaTabProps {
  trackerId: string;
  sizeCriteria: SizeCriteria | null;
  serviceCriteria: ServiceCriteria | null;
  geographyCriteria: GeographyCriteria | null;
  onSave?: () => void;
}

export function TrackerFitCriteriaTab({
  trackerId,
  sizeCriteria,
  serviceCriteria,
  geographyCriteria,
  onSave,
}: TrackerFitCriteriaTabProps) {
  return (
    <StructuredCriteriaPanel
      trackerId={trackerId}
      tracker={{
        size_criteria: sizeCriteria,
        service_criteria: serviceCriteria,
        geography_criteria: geographyCriteria,
      }}
      onSave={onSave}
    />
  );
}
