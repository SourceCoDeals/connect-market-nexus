import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TAG_LABELS } from "@/constants/statusTags";

interface ListingStatusTagProps {
  status: string | null;
  className?: string;
}

const STATUS_CONFIG = {
  just_listed: {
    colorToken: "primary",
    dotColor: "hsl(var(--primary))",
  },
  reviewing_buyers: {
    colorToken: "accent", 
    dotColor: "hsl(var(--accent))",
  },
  in_diligence: {
    colorToken: "secondary",
    dotColor: "hsl(var(--secondary))",
  },
  under_loi: {
    colorToken: "warning",
    dotColor: "hsl(var(--warning))",
  },
  accepted_offer: {
    colorToken: "success",
    dotColor: "hsl(var(--success))",
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
      variant="outline"
      className={cn(
        "absolute top-3 left-3 z-10 px-2.5 py-1 text-[10px] md:text-xs font-medium rounded-md",
        "bg-popover text-foreground border shadow-sm",
        "transition-all duration-200 ease-out",
        "backdrop-blur-sm",
        "hover:scale-105",
        "flex items-center gap-1.5",
        className
      )}
    >
      <div 
        className="w-1.5 h-1.5 rounded-full" 
        style={{ backgroundColor: config.dotColor }}
      />
      {label}
    </Badge>
  );
};

export default ListingStatusTag;