import { KPIConfigPanel } from "@/components/ma-intelligence/KPIConfigPanel";

interface TrackerKPIConfigTabProps {
  trackerId: string;
  kpiConfig: Record<string, unknown> | null;
  onSave?: () => void;
}

export function TrackerKPIConfigTab({
  trackerId,
  kpiConfig,
  onSave,
}: TrackerKPIConfigTabProps) {
  return (
    <KPIConfigPanel
      trackerId={trackerId}
      tracker={{
        kpi_scoring_config: kpiConfig as any,
      }}
      onSave={onSave}
    />
  );
}
