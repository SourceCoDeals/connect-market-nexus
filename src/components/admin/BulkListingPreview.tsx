
import { ParsedListing } from "@/types/bulk-listing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface BulkListingPreviewProps {
  listings: ParsedListing[];
}

export function BulkListingPreview({ listings }: BulkListingPreviewProps) {
  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto">
      {listings.map((listing, index) => (
        <Card key={index} className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{listing.title}</CardTitle>
              <Badge variant="outline">#{index + 1}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>📍 {listing.location}</span>
              <span>🏷️ {listing.category}</span>
              <span>💰 ${listing.revenue.toLocaleString()}</span>
              <span>📊 ${listing.ebitda.toLocaleString()}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {listing.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
