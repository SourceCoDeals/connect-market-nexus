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
    bgClass: "bg-black text-white border-black",
  },
  reviewing_buyers: {
    bgClass: "bg-black text-white border-black",
  },
  in_diligence: {
    bgClass: "bg-black text-white border-black",
  },
  under_loi: {
    bgClass: "bg-black text-white border-black",
  },
  accepted_offer: {
    bgClass: "bg-black text-white border-black",
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
        "px-2.5 py-1 text-[9px] font-semibold rounded-md uppercase tracking-[0.12em]",
        "inline-flex items-center border-0 shadow-none",
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