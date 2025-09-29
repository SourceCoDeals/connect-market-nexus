import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ListingStatusTagProps {
  status: string | null;
  className?: string;
}

const STATUS_CONFIG = {
  just_listed: {
    label: "Just Listed",
    variant: "default" as const,
    className:
      "bg-[linear-gradient(135deg,_hsl(var(--primary)),_hsl(var(--primary)/0.85))] text-primary-foreground border-[color:hsl(var(--primary)/0.2)] shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.45)]",
  },
  reviewing_buyers: {
    label: "Just Listed",
    variant: "default" as const,
    className:
      "bg-[linear-gradient(135deg,_hsl(var(--primary)),_hsl(var(--primary)/0.85))] text-primary-foreground border-[color:hsl(var(--primary)/0.2)] shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.45)]",
  },
  in_diligence: {
    label: "In Diligence",
    variant: "default" as const,
    className:
      "bg-[linear-gradient(135deg,_hsl(var(--accent)),_hsl(var(--accent)/0.85))] text-accent-foreground border-[color:hsl(var(--accent)/0.2)] shadow-[0_8px_24px_-8px_hsl(var(--accent)/0.45)]",
  },
  under_loi: {
    label: "Under LOI",
    variant: "default" as const,
    className:
      "bg-[linear-gradient(135deg,_hsl(var(--secondary)),_hsl(var(--secondary)/0.85))] text-secondary-foreground border-[color:hsl(var(--secondary)/0.2)] shadow-[0_8px_24px_-8px_hsl(var(--secondary)/0.3)]",
  },
  accepted_offer: {
    label: "Accepted Offer",
    variant: "default" as const,
    className:
      "bg-[linear-gradient(135deg,_hsl(var(--destructive)),_hsl(var(--destructive)/0.85))] text-destructive-foreground border-[color:hsl(var(--destructive)/0.2)] shadow-[0_8px_24px_-8px_hsl(var(--destructive)/0.4)]",
  },
} as const;

const ListingStatusTag = ({ status, className }: ListingStatusTagProps) => {
  if (!status || !(status in STATUS_CONFIG)) {
    return null;
  }

  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "absolute top-3 left-3 z-10 px-3 py-1.5 text-[10px] md:text-xs font-semibold rounded-full border",
        "transition-all duration-300 ease-out",
        "backdrop-blur-sm",
        "hover:scale-105",
        "shadow-sm",
        "animate-fade-in",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
};

export default ListingStatusTag;