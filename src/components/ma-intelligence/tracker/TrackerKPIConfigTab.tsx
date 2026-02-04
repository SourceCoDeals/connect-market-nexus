import { KPIConfigPanel } from "@/components/ma-intelligence/KPIConfigPanel";

interface TrackerKPIConfigTabProps {
  trackerId: string;
  kpiConfig: Record<string, unknown> | null;
  onSave: (config: Record<string, unknown>) => Promise<void>;
}

export function TrackerKPIConfigTab({
  trackerId,
  kpiConfig,
  onSave,
}: TrackerKPIConfigTabProps) {
  return (
    <KPIConfigPanel
      trackerId={trackerId}
      kpiConfig={kpiConfig}
      onSave={onSave}
    />
  );
}
