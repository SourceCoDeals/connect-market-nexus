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
    bgClass: "bg-slate-900/95 text-white border border-slate-800 backdrop-blur-md shadow-lg",
  },
  reviewing_buyers: {
    icon: Eye,
    bgClass: "bg-amber-500/95 text-white border border-amber-600 backdrop-blur-md shadow-lg",
  },
  in_diligence: {
    icon: FileText,
    bgClass: "bg-blue-500/95 text-white border border-blue-600 backdrop-blur-md shadow-lg",
  },
  under_loi: {
    icon: PenTool,
    bgClass: "bg-purple-500/95 text-white border border-purple-600 backdrop-blur-md shadow-lg",
  },
  accepted_offer: {
    icon: Handshake,
    bgClass: "bg-emerald-500/95 text-white border border-emerald-600 backdrop-blur-md shadow-lg",
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
        "absolute top-4 left-4 z-20 px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider",
        "flex items-center gap-1.5",
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