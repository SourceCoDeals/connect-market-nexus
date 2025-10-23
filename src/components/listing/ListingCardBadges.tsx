
import { MapPin } from "lucide-react";

interface ListingCardBadgesProps {
  location: string;
}

const ListingCardBadges = ({ location }: ListingCardBadgesProps) => {
  return (
    <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-50/50 text-[9px] font-medium uppercase tracking-[0.05em] text-slate-600">
      <MapPin className="w-2.5 h-2.5 opacity-40" strokeWidth={2} />
      <span className="leading-none">{location}</span>
    </div>
  );
};

export default ListingCardBadges;
