import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminConnectionRequest } from "@/types/admin";

interface ListingFilterSelectProps {
  requests: AdminConnectionRequest[];
  selectedListingId: string | null;
  onListingChange: (listingId: string | null) => void;
}

// Helper function to format listing display name for dropdown (Company Name - Title)
const formatListingForDropdown = (title: string, companyName?: string | null): string => {
  if (companyName && companyName.trim()) {
    return `${companyName} - ${title}`;
  }
  return title; // Show just the title if no company name
};

export function ListingFilterSelect({ requests, selectedListingId, onListingChange }: ListingFilterSelectProps) {
  const [open, setOpen] = useState(false);

  // Extract unique listings from requests with counts (show all listings regardless of company name)
  const uniqueListings = useMemo(() => {
    const listingMap = new Map();

    requests.forEach(request => {
      if (request.listing?.id && request.listing?.title) {
        const existing = listingMap.get(request.listing.id);
        if (existing) {
          existing.count++;
        } else {
          const displayName = formatListingForDropdown(request.listing.title, request.listing.internal_company_name);
          listingMap.set(request.listing.id, {
            id: request.listing.id,
            title: request.listing.title,
            internal_company_name: request.listing.internal_company_name,
            displayName,
            count: 1
          });
        }
      }
    });

    return Array.from(listingMap.values()).sort((a, b) => b.count - a.count);
  }, [requests]);

  const selectedListing = uniqueListings.find(l => l.id === selectedListingId);

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            role="combobox"
            aria-expanded={open}
            className="flex h-10 w-[280px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <span className="flex items-center gap-2 truncate">
              {selectedListing ? (
                <>
                  <span className="truncate">{selectedListing.displayName}</span>
                  <Badge variant="outline" className="shrink-0">{selectedListing.count}</Badge>
                </>
              ) : (
                <>
                  <span>Active Deals</span>
                  <Badge variant="secondary" className="shrink-0">{requests.length}</Badge>
                </>
              )}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search deals..." />
            <CommandList>
              <CommandEmpty>No deals found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="Active Deals"
                  onSelect={() => {
                    onListingChange(null);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !selectedListingId ? "opacity-100" : "opacity-0")} />
                  <span>Active Deals</span>
                  <Badge variant="secondary" className="ml-auto">{requests.length}</Badge>
                </CommandItem>
                {uniqueListings.map((listing) => (
                  <CommandItem
                    key={listing.id}
                    value={listing.displayName}
                    onSelect={() => {
                      onListingChange(listing.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selectedListingId === listing.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{listing.displayName}</span>
                    <Badge variant="outline" className="ml-auto shrink-0">{listing.count}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}