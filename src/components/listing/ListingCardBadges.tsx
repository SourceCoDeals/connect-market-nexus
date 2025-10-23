
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
    <div className="flex flex-wrap gap-2 mb-2">
      {displayCategories.map((cat, index) => (
        <Badge key={index} variant="outline" className="bg-background font-normal">
          <Building2 className="h-3 w-3 mr-1" />
          {cat}
        </Badge>
      ))}
      <Badge 
        variant="secondary" 
        className="bg-primary/10 text-primary font-medium border-primary/20 shadow-sm"
      >
        <MapPin className="h-3.5 w-3.5 mr-1.5" />
        {location}
      </Badge>
    </div>
  );
};

export default ListingCardBadges;
