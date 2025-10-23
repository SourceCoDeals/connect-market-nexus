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
    bgClass: "bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-white/10 shadow-lg shadow-slate-900/20",
  },
  reviewing_buyers: {
    icon: Eye,
    bgClass: "bg-gradient-to-br from-amber-500 to-amber-600 text-white border border-white/20 shadow-lg shadow-amber-500/30",
  },
  in_diligence: {
    icon: FileCheck,
    bgClass: "bg-gradient-to-br from-blue-500 to-blue-600 text-white border border-white/20 shadow-lg shadow-blue-500/30",
  },
  under_loi: {
    icon: Edit3,
    bgClass: "bg-gradient-to-br from-violet-500 to-violet-600 text-white border border-white/20 shadow-lg shadow-violet-500/30",
  },
  accepted_offer: {
    icon: HandshakeIcon,
    bgClass: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border border-white/20 shadow-lg shadow-emerald-500/30",
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
        "absolute top-2 right-3 z-20 px-2.5 py-1.5 text-[9.5px] font-semibold rounded-lg uppercase tracking-[0.06em]",
        "flex items-center gap-1.5 backdrop-blur-md",
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