
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
    <div className="flex flex-wrap gap-1.5 mb-3">
      {displayCategories.map((cat, index) => (
        <Badge 
          key={index} 
          variant="outline" 
          className="bg-muted/40 border-border/50 text-muted-foreground text-[11px] font-medium px-2 py-0.5 rounded-md tracking-wide"
        >
          <Building2 className="h-3 w-3 mr-1 opacity-60" />
          {cat}
        </Badge>
      ))}
      <Badge 
        variant="secondary" 
        className="bg-primary/8 text-primary/90 border border-primary/15 text-[11px] font-medium px-2 py-0.5 rounded-md tracking-wide"
      >
        <MapPin className="h-3 w-3 mr-1 opacity-70" />
        {location}
      </Badge>
    </div>
  );
};

export default ListingCardBadges;
