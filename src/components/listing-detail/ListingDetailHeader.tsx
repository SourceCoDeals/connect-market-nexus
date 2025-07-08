
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, ChevronLeft, AlertTriangle } from "lucide-react";

interface ListingDetailHeaderProps {
  title: string;
  category: string;
  location: string;
  isInactive: boolean;
  isAdmin: boolean;
}

export const ListingDetailHeader = ({ 
  title, 
  category, 
  location, 
  isInactive, 
  isAdmin 
}: ListingDetailHeaderProps) => {
  return (
    <>
      <div className="mb-6">
        <Link
          to="/marketplace"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Marketplace
        </Link>
      </div>
      
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
      </div>
    </>
  );
};
