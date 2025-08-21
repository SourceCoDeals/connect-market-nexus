import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";

interface ListingFilterSelectProps {
  requests: AdminConnectionRequest[];
  selectedListingId: string | null;
  onListingChange: (listingId: string | null) => void;
}

// Helper function to format listing display name
const formatListingDisplayName = (title: string, companyName?: string | null): string => {
  if (companyName && companyName.trim()) {
    return `${title}/${companyName}`;
  }
  return title;
};

export function ListingFilterSelect({ requests, selectedListingId, onListingChange }: ListingFilterSelectProps) {
  // Extract unique listings from requests with counts
  const getUniqueListings = () => {
    const listingMap = new Map();
    
    requests.forEach(request => {
      if (request.listing?.id) {
        const existing = listingMap.get(request.listing.id);
        if (existing) {
          existing.count++;
        } else {
          listingMap.set(request.listing.id, {
            id: request.listing.id,
            title: request.listing.title,
            internal_company_name: request.listing.internal_company_name,
            displayName: formatListingDisplayName(request.listing.title, request.listing.internal_company_name),
            count: 1
          });
        }
      }
    });
    
    return Array.from(listingMap.values()).sort((a, b) => b.count - a.count);
  };

  const uniqueListings = getUniqueListings();

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedListingId || "all"} onValueChange={(value) => onListingChange(value === "all" ? null : value)}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Filter by Deal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center justify-between w-full">
              <span>All Deals</span>
              <Badge variant="secondary" className="ml-2">
                {requests.length}
              </Badge>
            </div>
          </SelectItem>
          {uniqueListings.map((listing) => (
            <SelectItem key={listing.id} value={listing.id}>
              <div className="flex items-center justify-between w-full">
                <span className="truncate max-w-[200px]">{listing.displayName}</span>
                <Badge variant="outline" className="ml-2">
                  {listing.count}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}