import { TrackerQueryChat } from "@/components/ma-intelligence/TrackerQueryChat";

interface TrackerQueryTabProps {
  trackerId: string;
  trackerName?: string;
}

export function TrackerQueryTab({ trackerId, trackerName = "Industry" }: TrackerQueryTabProps) {
  return <TrackerQueryChat trackerId={trackerId} trackerName={trackerName} />;
}
