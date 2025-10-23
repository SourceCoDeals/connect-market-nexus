
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
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/30 border border-border/30 text-[10.5px] font-medium tracking-wide text-foreground/70"
        >
          <Briefcase className="h-2.5 w-2.5 opacity-60" strokeWidth={2.5} />
          <span>{cat}</span>
        </div>
      ))}
      <div 
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/30 border border-border/30 text-[10.5px] font-medium tracking-wide text-foreground/70"
      >
        <MapPin className="h-2.5 w-2.5 opacity-60" strokeWidth={2.5} />
        <span>{location}</span>
      </div>
    </div>
  );
};

export default ListingCardBadges;
