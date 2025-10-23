
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin } from "lucide-react";

interface ListingCardBadgesProps {
  categories: string[];
  location: string;
  category?: string; // Keep for backward compatibility
}

const ListingCardBadges = ({ categories, location, category }: ListingCardBadgesProps) => {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      <Badge 
        variant="subtle" 
        className="text-[11px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wide text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
      >
        <MapPin className="h-3 w-3 mr-1" />
        {location}
      </Badge>
    </div>
  );
};

export default ListingCardBadges;
