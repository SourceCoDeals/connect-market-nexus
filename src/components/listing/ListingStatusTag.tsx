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
    bgClass: "bg-slate-800 text-white border border-slate-700/50 backdrop-blur-sm",
  },
  reviewing_buyers: {
    icon: Eye,
    bgClass: "bg-amber-50 text-amber-900 border border-amber-200/60 backdrop-blur-sm",
  },
  in_diligence: {
    icon: FileText,
    bgClass: "bg-stone-100 text-stone-800 border border-stone-200/60 backdrop-blur-sm",
  },
  under_loi: {
    icon: PenTool,
    bgClass: "bg-slate-800 text-white border border-slate-700/50 backdrop-blur-sm",
  },
  accepted_offer: {
    icon: Handshake,
    bgClass: "bg-emerald-800 text-white border border-emerald-700/50 backdrop-blur-sm",
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
        "absolute -top-2 left-3 z-20 px-3 py-1.5 text-xs font-medium rounded-lg uppercase tracking-wide",
        "flex items-center gap-1.5 shadow-lg",
        config.bgClass,
        className
      )}
    >
      <IconComponent size={12} className="opacity-90" />
      {label}
    </Badge>
  );
};

export default ListingStatusTag;