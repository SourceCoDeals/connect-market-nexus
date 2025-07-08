
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, AlertTriangle } from "lucide-react";

interface ListingDetailHeaderProps {
  title: string;
  category: string;
  location: string;
  isInactive: boolean;
  isAdmin: boolean;
  connectionButton: React.ReactNode;
}

const ListingDetailHeader = ({
  title,
  category,
  location,
  isInactive,
  isAdmin,
  connectionButton
}: ListingDetailHeaderProps) => {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
      <div className="flex-1">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className="bg-background font-normal">
            <Building2 className="h-3 w-3 mr-1" />
            {category}
          </Badge>
          <Badge variant="outline" className="bg-background font-normal">
            <MapPin className="h-3 w-3 mr-1" />
            {location}
          </Badge>
          {isInactive && isAdmin && (
            <Badge variant="destructive" className="font-normal">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Inactive
            </Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
      </div>

      <div className="w-full md:w-auto">
        {connectionButton}
      </div>
    </div>
  );
};

export default ListingDetailHeader;
