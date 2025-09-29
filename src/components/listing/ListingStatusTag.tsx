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
    bgClass: "bg-[linear-gradient(135deg,_hsl(var(--primary)),_hsl(var(--primary)/0.85))] text-primary-foreground border-[color:hsl(var(--primary)/0.2)]",
  },
  reviewing_buyers: {
    colorToken: "accent", 
    dotColor: "hsl(var(--accent))",
    bgClass: "bg-[linear-gradient(135deg,_hsl(var(--accent)),_hsl(var(--accent)/0.85))] text-accent-foreground border-[color:hsl(var(--accent)/0.2)]",
  },
  in_diligence: {
    colorToken: "secondary",
    dotColor: "hsl(var(--secondary))",
    bgClass: "bg-[linear-gradient(135deg,_hsl(var(--secondary)),_hsl(var(--secondary)/0.85))] text-secondary-foreground border-[color:hsl(var(--secondary)/0.2)]",
  },
  under_loi: {
    colorToken: "warning",
    dotColor: "hsl(var(--warning))",
    bgClass: "bg-[linear-gradient(135deg,_hsl(var(--warning)),_hsl(var(--warning)/0.85))] text-warning-foreground border-[color:hsl(var(--warning)/0.2)]",
  },
  accepted_offer: {
    colorToken: "success",
    dotColor: "hsl(var(--success))",
    bgClass: "bg-[linear-gradient(135deg,_hsl(var(--success)),_hsl(var(--success)/0.85))] text-success-foreground border-[color:hsl(var(--success)/0.2)]",
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
        "absolute top-3 left-3 z-10 px-3 py-1.5 text-[10px] md:text-xs font-semibold rounded-full border",
        "transition-all duration-300 ease-out",
        "backdrop-blur-sm",
        "hover:scale-105",
        "shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.45)]",
        "animate-fade-in",
        config.bgClass,
        className
      )}
    >
      {label}
    </Badge>
  );
};

export default ListingStatusTag;