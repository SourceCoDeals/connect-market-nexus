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
    bgClass: "bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 text-white border border-white/15 shadow-lg shadow-indigo-900/30",
  },
  in_diligence: {
    icon: FileCheck,
    bgClass: "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white border border-white/15 shadow-lg shadow-slate-900/30",
  },
  under_loi: {
    icon: Edit3,
    bgClass: "bg-gradient-to-br from-violet-600 via-violet-700 to-violet-800 text-white border border-white/15 shadow-lg shadow-violet-900/30",
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
        "absolute right-3 bottom-0 translate-y-1/2 z-20 px-2.5 py-1.5 text-[9.5px] font-semibold rounded-lg uppercase tracking-[0.06em]",
        "flex items-center gap-1.5 backdrop-blur-md ring-1 ring-black/5",
        config.bgClass,
        className
      )}
    >
      <IconComponent size={10} strokeWidth={2.5} />
      {label}
    </Badge>
  );
};

export default ListingStatusTag;