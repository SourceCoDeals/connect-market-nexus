
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin } from "lucide-react";

interface ListingCardBadgesProps {
  categories: string[];
  location: string;
  category?: string; // Keep for backward compatibility
}

const ListingCardBadges = ({ categories, location, category }: ListingCardBadgesProps) => {
  // Use categories array or fall back to single category for backward compatibility
  const displayCategories = categories && categories.length > 0 ? categories : (category ? [category] : []);
  
  return (
    <div className="flex flex-wrap gap-1.5">
      {displayCategories.map((cat, index) => (
        <div 
          key={index} 
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/20 border border-border/20 text-[10px] font-medium tracking-wide text-foreground/60"
        >
          <Briefcase className="h-2.5 w-2.5 opacity-50" strokeWidth={2} />
          <span className="leading-none">{cat}</span>
        </div>
      ))}
      <div 
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/20 border border-border/20 text-[10px] font-medium tracking-wide text-foreground/60"
      >
        <MapPin className="h-2.5 w-2.5 opacity-50" strokeWidth={2} />
        <span className="leading-none">{location}</span>
      </div>
    </div>
  );
};

export default ListingCardBadges;
