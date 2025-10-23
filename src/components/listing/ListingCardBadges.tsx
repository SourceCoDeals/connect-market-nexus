
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

interface ListingCardBadgesProps {
  location: string;
}

const ListingCardBadges = ({ location }: ListingCardBadgesProps) => {
  return (
    <div className="mb-4">
      <Badge 
        variant="secondary" 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-slate-700 border border-slate-200 text-[11px] font-semibold uppercase tracking-widest rounded-md"
      >
        <MapPin className="w-3.5 h-3.5" />
        {location}
      </Badge>
    </div>
  );
};

export default ListingCardBadges;
