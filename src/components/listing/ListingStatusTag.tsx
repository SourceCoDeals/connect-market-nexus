import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TAG_LABELS } from "@/constants/statusTags";
import { CheckCircle, Eye, FileText, PenTool, Handshake } from "lucide-react";

interface ListingStatusTagProps {
  status: string | null;
  className?: string;
}

const STATUS_CONFIG = {
  just_listed: {
    icon: CheckCircle,
    bgClass: "bg-white text-slate-800 border border-slate-300",
  },
  reviewing_buyers: {
    icon: Eye,
    bgClass: "bg-white text-amber-800 border border-amber-300",
  },
  in_diligence: {
    icon: FileText,
    bgClass: "bg-white text-stone-800 border border-stone-300",
  },
  under_loi: {
    icon: PenTool,
    bgClass: "bg-white text-slate-800 border border-slate-300",
  },
  accepted_offer: {
    icon: Handshake,
    bgClass: "bg-white text-emerald-800 border border-emerald-300",
  },
} as const;

const ListingStatusTag = ({ status, className }: ListingStatusTagProps) => {
  if (!status || !(status in STATUS_CONFIG)) {
    return null;
  }

  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const label = STATUS_TAG_LABELS[status] || status;
  const IconComponent = config.icon;

  return (
    <Badge
      variant="default"
      className={cn(
        "absolute -top-2.5 left-6 z-10",
        "inline-flex items-center gap-1.5 px-3 py-1.5",
        "text-[10px] font-bold uppercase tracking-[0.06em]",
        "rounded-full shadow-sm",
        "transition-all duration-200",
        config.bgClass,
        className
      )}
    >
      <IconComponent size={12} />
      {label}
    </Badge>
  );
};

export default ListingStatusTag;