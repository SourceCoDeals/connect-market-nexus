import { Layers, Building2 } from "lucide-react";

interface AcquisitionTypeBadgeProps {
  type: 'add_on' | 'platform' | string | null | undefined;
  className?: string;
}

const AcquisitionTypeBadge = ({ type, className = "" }: AcquisitionTypeBadgeProps) => {
  if (!type || (type !== 'add_on' && type !== 'platform')) return null;

  const config: Record<'add_on' | 'platform', { label: string; icon: typeof Layers }> = {
    add_on: {
      label: "Add-On",
      icon: Layers,
    },
    platform: {
      label: "Platform",
      icon: Building2,
    }
  };

  const { label, icon: Icon } = config[type];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#D8B75D] ${className}`}>
      <Icon className="w-3 h-3 text-[#000000]" strokeWidth={2.5} />
      <span className="text-[11px] font-semibold text-[#000000] uppercase tracking-[0.05em] leading-none">
        {label}
      </span>
    </div>
  );
};

export default AcquisitionTypeBadge;
