import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TAG_LABELS } from "@/constants/statusTags";
import { Sparkles, Eye, FileCheck, Edit3, HandshakeIcon } from "lucide-react";

interface ListingStatusTagProps {
  status: string | null;
  className?: string;
}

const STATUS_CONFIG = {
  just_listed: {
    icon: Sparkles,
    bgClass: "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white border border-white/10 shadow-lg shadow-slate-900/30",
  },
  reviewing_buyers: {
    icon: Eye,
    bgClass: "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white border border-white/15 shadow-lg shadow-slate-900/25",
  },
  in_diligence: {
    icon: FileCheck,
    bgClass: "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white border border-white/15 shadow-lg shadow-slate-900/30",
  },
  under_loi: {
    icon: Edit3,
    bgClass: "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white border border-white/15 shadow-lg shadow-slate-900/30",
  },
  accepted_offer: {
    icon: HandshakeIcon,
    bgClass: "bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white border border-white/15 shadow-lg shadow-emerald-900/30",
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
        "absolute bottom-3 left-3 z-10 px-3 py-1.5 text-[11px] font-bold rounded-full uppercase tracking-[0.06em]",
        "inline-flex items-center gap-1.5 shadow-lg transition-all duration-200",
        config.bgClass,
        className
      )}
    >
      <IconComponent size={12} strokeWidth={2.5} />
      {label}
    </Badge>
  );
};

export default ListingStatusTag;