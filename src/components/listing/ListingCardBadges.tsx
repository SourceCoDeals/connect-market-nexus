
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

interface ListingCardBadgesProps {
  location: string;
}

const ListingCardBadges = ({ location }: ListingCardBadgesProps) => {
  return (
    <div className="mb-3">
      <Badge 
        variant="secondary" 
        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-semibold uppercase tracking-[0.05em] rounded-md"
      >
        <MapPin className="w-3 h-3" />
        {location}
      </Badge>
    </div>
  );
};

export default ListingCardBadges;
