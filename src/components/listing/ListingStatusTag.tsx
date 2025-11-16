import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TAG_LABELS } from "@/constants/statusTags";

interface ListingStatusTagProps {
  status: string | null;
  className?: string;
  variant?: 'absolute' | 'inline';
}

const STATUS_CONFIG = {
  just_listed: {
    bgClass: "bg-[#0a0a0a] text-white border-[#0a0a0a]",
  },
  reviewing_buyers: {
    bgClass: "bg-[#0a0a0a] text-white border-[#0a0a0a]",
  },
  in_diligence: {
    bgClass: "bg-[#0a0a0a] text-white border-[#0a0a0a]",
  },
  under_loi: {
    bgClass: "bg-[#0a0a0a] text-white border-[#0a0a0a]",
  },
  accepted_offer: {
    bgClass: "bg-[#0a0a0a] text-white border-[#0a0a0a]",
  },
} as const;

const ListingStatusTag = ({ status, className, variant = 'absolute' }: ListingStatusTagProps) => {
  if (!status || !(status in STATUS_CONFIG)) {
    return null;
  }

  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const label = STATUS_TAG_LABELS[status] || status;

  return (
    <Badge
      variant="default"
      className={cn(
        "px-2.5 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-[0.08em]",
        "inline-flex items-center shadow-[0_1px_2px_rgba(0,0,0,0.12)] border",
        variant === 'absolute' && "absolute bottom-3 left-3 z-10",
        config.bgClass,
        className
      )}
    >
      {label}
    </Badge>
  );
};

export default ListingStatusTag;