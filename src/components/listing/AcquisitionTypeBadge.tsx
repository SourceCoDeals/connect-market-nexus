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
    <div className={`inline-flex items-center px-2.5 py-1 rounded-md bg-[#D8B75D] ${className}`}>
      <span className="text-[10px] font-bold text-[#000000] uppercase tracking-[0.12em] leading-none">
        {label}
      </span>
    </div>
  );
};

export default AcquisitionTypeBadge;
