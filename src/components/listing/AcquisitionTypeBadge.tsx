interface AcquisitionTypeBadgeProps {
  type: 'add_on' | 'platform' | string | null | undefined;
  className?: string;
}

const AcquisitionTypeBadge = ({ type, className = "" }: AcquisitionTypeBadgeProps) => {
  if (!type || (type !== 'add_on' && type !== 'platform')) return null;

  const config: Record<'add_on' | 'platform', { label: string }> = {
    add_on: {
      label: "Add-On",
    },
    platform: {
      label: "Platform",
    }
  };

  const { label } = config[type];

  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded-md bg-[#C5A572] ${className}`}>
      <span className="text-[10px] font-bold text-black uppercase tracking-[0.12em]">
        {label}
      </span>
    </div>
  );
};

export default AcquisitionTypeBadge;
