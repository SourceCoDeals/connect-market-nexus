
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin } from "lucide-react";

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
        <Badge 
          key={index} 
          variant="outline" 
          className="bg-muted/40 border-border/40 font-medium text-[11px] px-2.5 py-0.5 tracking-wide"
        >
          <Building2 className="h-3 w-3 mr-1" />
          {cat}
        </Badge>
      ))}
      <Badge 
        variant="secondary" 
        className="bg-muted/60 text-foreground font-medium border-border/40 text-[11px] px-2.5 py-0.5 tracking-wide"
      >
        <MapPin className="h-3 w-3 mr-1" />
        {location}
      </Badge>
    </div>
  );
};

export default ListingCardBadges;
