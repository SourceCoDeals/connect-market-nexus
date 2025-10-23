
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
    <div className="flex flex-wrap gap-2 mb-3">
      {displayCategories.map((cat, index) => (
        <Badge 
          key={index} 
          variant="subtle" 
          className="text-[10px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wider text-muted-foreground/70 border-border/40 bg-transparent"
        >
          <Building2 className="h-2.5 w-2.5 mr-1 opacity-50" />
          {cat}
        </Badge>
      ))}
      <Badge 
        variant="subtle" 
        className="text-[10px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wider text-muted-foreground/70 border-border/40 bg-transparent"
      >
        <MapPin className="h-2.5 w-2.5 mr-1 opacity-50" />
        {location}
      </Badge>
    </div>
  );
};

export default ListingCardBadges;
