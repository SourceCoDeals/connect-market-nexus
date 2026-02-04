import { TrackerQueryChat } from "@/components/ma-intelligence/TrackerQueryChat";

interface TrackerQueryTabProps {
  trackerId: string;
}

export function TrackerQueryTab({ trackerId }: TrackerQueryTabProps) {
  return <TrackerQueryChat trackerId={trackerId} />;
}
