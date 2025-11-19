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
    <div className={`inline-flex items-center px-2.5 py-1 rounded-md bg-[#C5A572]/90 ${className}`}>
      <span className="text-[9px] font-normal text-black uppercase tracking-[0.08em]">
        {label}
      </span>
    </div>
  );
};

export default AcquisitionTypeBadge;
