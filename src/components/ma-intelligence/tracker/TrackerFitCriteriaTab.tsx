import { StructuredCriteriaPanel } from "@/components/ma-intelligence/StructuredCriteriaPanel";
import type { SizeCriteria, ServiceCriteria, GeographyCriteria } from "@/lib/ma-intelligence/types";

interface TrackerFitCriteriaTabProps {
  trackerId: string;
  sizeCriteria: SizeCriteria | null;
  serviceCriteria: ServiceCriteria | null;
  geographyCriteria: GeographyCriteria | null;
  onSave: (criteria: {
    size_criteria?: SizeCriteria;
    service_criteria?: ServiceCriteria;
    geography_criteria?: GeographyCriteria;
  }) => Promise<void>;
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
      sizeCriteria={sizeCriteria}
      serviceCriteria={serviceCriteria}
      geographyCriteria={geographyCriteria}
      onSave={onSave}
    />
  );
}
