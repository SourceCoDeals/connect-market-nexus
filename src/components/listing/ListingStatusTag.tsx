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
    bgClass: "bg-slate-900/95 text-white/95 border border-slate-700/30 backdrop-blur-sm shadow-sm",
  },
  reviewing_buyers: {
    icon: Eye,
    bgClass: "bg-white/95 text-amber-900 border border-amber-200/40 backdrop-blur-sm shadow-sm",
  },
  in_diligence: {
    icon: FileText,
    bgClass: "bg-white/95 text-stone-800 border border-stone-200/40 backdrop-blur-sm shadow-sm",
  },
  under_loi: {
    icon: PenTool,
    bgClass: "bg-slate-900/95 text-white/95 border border-slate-700/30 backdrop-blur-sm shadow-sm",
  },
  accepted_offer: {
    icon: Handshake,
    bgClass: "bg-emerald-900/95 text-white/95 border border-emerald-700/30 backdrop-blur-sm shadow-sm",
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
        "absolute -top-2 left-3 z-20 px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase tracking-wider",
        "flex items-center gap-1.5 shadow-md",
        config.bgClass,
        className
      )}
    >
      <IconComponent size={11} className="opacity-80" />
      {label}
    </Badge>
  );
};

export default ListingStatusTag;