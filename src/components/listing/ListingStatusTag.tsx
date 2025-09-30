import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TAG_LABELS } from "@/constants/statusTags";

interface ListingStatusTagProps {
  status: string | null;
  className?: string;
}

const STATUS_CONFIG = {
  just_listed: {
    colorToken: "sourceco",
    bgClass: "bg-sourceco text-white border border-sourceco/20 shadow-sm",
  },
  reviewing_buyers: {
    colorToken: "sourceco", 
    bgClass: "bg-amber-600 text-white border border-amber-600/20 shadow-sm",
  },
  in_diligence: {
    colorToken: "sourceco",
    bgClass: "bg-amber-700 text-white border border-amber-700/20 shadow-sm",
  },
  under_loi: {
    colorToken: "sourceco",
    bgClass: "bg-amber-800 text-white border border-amber-800/20 shadow-sm",
  },
  accepted_offer: {
    colorToken: "sourceco",
    bgClass: "bg-emerald-600 text-white border border-emerald-600/20 shadow-sm",
  },
} as const;

const ListingStatusTag = ({ status, className }: ListingStatusTagProps) => {
  if (!status || !(status in STATUS_CONFIG)) {
    return null;
  }

  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const label = STATUS_TAG_LABELS[status] || status;

  return (
    <Badge
      variant="default"
      className={cn(
        "absolute -top-2 left-3 z-20 px-4 py-1.5 text-xs font-semibold rounded-md uppercase tracking-wide",
        config.bgClass,
        className
      )}
    >
      {label}
    </Badge>
  );
};

export default ListingStatusTag;