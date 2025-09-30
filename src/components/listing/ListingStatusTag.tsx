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
    bgClass: "bg-sourceco text-sourceco-foreground border border-sourceco/30",
  },
  reviewing_buyers: {
    colorToken: "sourceco", 
    bgClass: "bg-sourceco-accent text-sourceco-accent-foreground border border-sourceco-accent/30",
  },
  in_diligence: {
    colorToken: "sourceco",
    bgClass: "bg-sourceco-muted text-sourceco-muted-foreground border border-sourceco-muted/30",
  },
  under_loi: {
    colorToken: "sourceco",
    bgClass: "bg-sourceco text-sourceco-foreground border border-sourceco/30",
  },
  accepted_offer: {
    colorToken: "sourceco",
    bgClass: "bg-sourceco-accent text-sourceco-accent-foreground border border-sourceco-accent/30",
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
        "absolute top-2 left-2 z-20 px-4 py-1.5 text-xs font-semibold rounded-md",
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