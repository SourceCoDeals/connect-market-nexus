import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ListingStatusTagProps {
  status: string | null;
  className?: string;
}

const STATUS_CONFIG = {
  just_added: {
    label: "Just Added",
    variant: "default" as const,
    className: "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-500/20 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 font-medium tracking-wide",
  },
  reviewing_buyers: {
    label: "Reviewing Buyers", 
    variant: "secondary" as const,
    className: "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500/20 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 font-medium tracking-wide",
  },
  in_diligence: {
    label: "In Diligence",
    variant: "outline" as const, 
    className: "bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-500/20 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 font-medium tracking-wide",
  },
  under_loi: {
    label: "Under LOI",
    variant: "destructive" as const,
    className: "bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-500/20 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 font-medium tracking-wide",
  },
  accepted_offer: {
    label: "Accepted Offer", 
    variant: "outline" as const,
    className: "bg-gradient-to-r from-slate-500 to-slate-600 text-white border-slate-500/20 shadow-lg shadow-slate-500/25 hover:shadow-slate-500/40 font-medium tracking-wide",
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
        "absolute top-3 left-3 z-10 px-3 py-1.5 text-xs font-semibold",
        "transition-all duration-300 ease-out",
        "backdrop-blur-sm",
        "hover:scale-105 hover:-translate-y-0.5",
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