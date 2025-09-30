import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TAG_LABELS } from "@/constants/statusTags";

interface ListingStatusTagProps {
  status: string | null;
  className?: string;
}

const STATUS_CONFIG = {
  just_listed: {
    colorToken: "success",
    bgClass: "bg-success text-success-foreground border border-success/20",
  },
  reviewing_buyers: {
    colorToken: "sourceco",
    bgClass: "bg-sourceco-accent text-sourceco-accent-foreground border border-sourceco-accent/20",
  },
  in_diligence: {
    colorToken: "warning", 
    bgClass: "bg-warning text-warning-foreground border border-warning/20",
  },
  under_loi: {
    colorToken: "sourceco",
    bgClass: "bg-sourceco text-sourceco-foreground border border-sourceco/20",
  },
  accepted_offer: {
    colorToken: "success",
    bgClass: "bg-success text-success-foreground border border-success/20",
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
        "absolute -top-2 -left-2 z-20 px-3 py-1 text-[10px] md:text-xs font-semibold rounded-md",
        "transition-all duration-300 ease-out",
        "shadow-sm",
        config.bgClass,
        className
      )}
    >
      {label}
    </Badge>
  );
};

export default ListingStatusTag;