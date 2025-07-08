
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin } from "lucide-react";

interface ListingCardBadgesProps {
  category: string;
  location: string;
}

const ListingCardBadges = ({ category, location }: ListingCardBadgesProps) => {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      <Badge variant="outline" className="bg-background font-normal">
        <Building2 className="h-3 w-3 mr-1" />
        {category}
      </Badge>
      <Badge variant="outline" className="bg-background font-normal">
        <MapPin className="h-3 w-3 mr-1" />
        {location}
      </Badge>
    </div>
  );
};

export default ListingCardBadges;
