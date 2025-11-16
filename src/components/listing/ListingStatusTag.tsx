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
    bgClass: "bg-slate-700 text-white border-slate-600",
  },
  reviewing_buyers: {
    bgClass: "bg-slate-600 text-white border-slate-500",
  },
  in_diligence: {
    bgClass: "bg-slate-500 text-white border-slate-400",
  },
  under_loi: {
    bgClass: "bg-slate-700 text-white border-slate-600",
  },
  accepted_offer: {
    bgClass: "bg-success text-success-foreground border-success",
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
        "px-2.5 py-1.5 text-[10px] font-medium rounded-lg uppercase tracking-[0.02em]",
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