import { AddOnIcon, PlatformIcon } from "@/components/icons/AcquisitionTypeIcons";

interface AcquisitionTypeBadgeProps {
  type: 'add_on' | 'platform' | string | null | undefined;
  className?: string;
}

const AcquisitionTypeBadge = ({ type, className = "" }: AcquisitionTypeBadgeProps) => {
  if (!type || (type !== 'add_on' && type !== 'platform')) return null;

  const config: Record<'add_on' | 'platform', any> = {
    add_on: {
      icon: AddOnIcon,
      label: "Add-On",
      iconClass: "text-purple-500"
    },
    platform: {
      icon: PlatformIcon,
      label: "Platform",
      iconClass: "text-blue-500"
    }
  };

  const { icon: Icon, label, iconClass } = config[type];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${className}`}>
      <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
      <span className="text-[10px] font-medium text-slate-700 tracking-[0.02em]">
        {label}
      </span>
    </div>
  );
};

export default AcquisitionTypeBadge;
