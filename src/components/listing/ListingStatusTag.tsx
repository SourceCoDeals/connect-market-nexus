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
    bgClass: "bg-white/98 text-slate-800 border-l-[3px] border-l-slate-900 border border-slate-200/60 backdrop-blur-sm shadow-sm",
  },
  reviewing_buyers: {
    icon: Eye,
    bgClass: "bg-white/98 text-amber-800 border-l-[3px] border-l-amber-500 border border-amber-200/50 backdrop-blur-sm shadow-sm",
  },
  in_diligence: {
    icon: FileText,
    bgClass: "bg-white/98 text-blue-800 border-l-[3px] border-l-blue-500 border border-blue-200/50 backdrop-blur-sm shadow-sm",
  },
  under_loi: {
    icon: PenTool,
    bgClass: "bg-white/98 text-purple-800 border-l-[3px] border-l-purple-500 border border-purple-200/50 backdrop-blur-sm shadow-sm",
  },
  accepted_offer: {
    icon: Handshake,
    bgClass: "bg-white/98 text-emerald-800 border-l-[3px] border-l-emerald-500 border border-emerald-200/50 backdrop-blur-sm shadow-sm",
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
        "absolute top-3 left-3 z-20 px-2 py-1 text-[9px] font-semibold rounded uppercase tracking-[0.06em]",
        "flex items-center gap-1.5 shadow-sm",
        config.bgClass,
        className
      )}
    >
      <IconComponent size={10} className="opacity-70" />
      {label}
    </Badge>
  );
};

export default ListingStatusTag;