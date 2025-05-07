
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Listing } from "@/types";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ListingCardProps {
  listing: Listing;
  viewType?: "grid" | "list";
  onRequestConnection: (listingId: string) => void;
  alreadyRequested?: boolean;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
};

const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  viewType = "grid",
  onRequestConnection,
  alreadyRequested = false,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestConnection = () => {
    setIsRequesting(true);
    setTimeout(() => {
      onRequestConnection(listing.id);
      setIsRequesting(false);
    }, 1000);
  };

  if (viewType === "list") {
    return (
      <Card className="overflow-hidden transition-all hover:border-primary/50">
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 p-6">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="mb-2 line-clamp-1">
                  <Link to={`/marketplace/${listing.id}`} className="hover:text-primary transition-colors">
                    {listing.title}
                  </Link>
                </CardTitle>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="outline" className="bg-muted">
                    {listing.category}
                  </Badge>
                  <Badge variant="outline" className="bg-muted">
                    {listing.location}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <div className="bg-muted/50 px-2 py-1 rounded text-sm">
                  Revenue: <span className="font-medium">{formatCurrency(listing.revenue)}</span>
                </div>
                <div className="bg-muted/50 px-2 py-1 rounded text-sm">
                  EBITDA: <span className="font-medium">{formatCurrency(listing.ebitda)}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {listing.description}
            </p>
          </div>
          <div className="p-4 md:p-6 flex items-end justify-center md:border-l border-border bg-muted/20">
            <Button
              onClick={handleRequestConnection}
              disabled={isRequesting || alreadyRequested}
              className="min-w-[180px]"
            >
              {isRequesting
                ? "Sending request..."
                : alreadyRequested
                ? "Connection Requested"
                : "Request Connection"}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "overflow-hidden h-full flex flex-col transition-all hover:border-primary/50",
    )}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className="bg-muted/50">
            {listing.category}
          </Badge>
          <Badge variant="outline" className="bg-muted/50">
            {listing.location}
          </Badge>
        </div>
        <CardTitle className="line-clamp-1">
          <Link to={`/marketplace/${listing.id}`} className="hover:text-primary transition-colors">
            {listing.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-muted/30 p-2 rounded">
            <div className="text-xs text-muted-foreground">Revenue</div>
            <div className="font-medium">{formatCurrency(listing.revenue)}</div>
          </div>
          <div className="bg-muted/30 p-2 rounded">
            <div className="text-xs text-muted-foreground">EBITDA</div>
            <div className="font-medium">{formatCurrency(listing.ebitda)}</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {listing.description}
        </p>
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          onClick={handleRequestConnection}
          disabled={isRequesting || alreadyRequested}
          className="w-full"
        >
          {isRequesting
            ? "Sending request..."
            : alreadyRequested
            ? "Connection Requested"
            : "Request Connection"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ListingCard;
