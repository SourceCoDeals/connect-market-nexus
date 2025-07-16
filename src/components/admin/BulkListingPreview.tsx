
import { ParsedListing } from "@/types/bulk-listing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ImageIcon, ExternalLink } from "lucide-react";
import { DEFAULT_IMAGE } from "@/lib/storage-utils";

interface BulkListingPreviewProps {
  listings: ParsedListing[];
}

export function BulkListingPreview({ listings }: BulkListingPreviewProps) {
  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto">
      {listings.map((listing, index) => (
        <Card key={index} className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{listing.title}</CardTitle>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-1">
                  <span>📍 {listing.location}</span>
                  <span>🏷️ {listing.category}</span>
                  <span>💰 ${listing.revenue.toLocaleString()}</span>
                  <span>📊 ${listing.ebitda.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">#{index + 1}</Badge>
                {listing.image_url && (
                  <Badge variant="secondary">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    Image
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Image Preview */}
              <div className="md:col-span-1">
                <AspectRatio ratio={16/9} className="bg-muted rounded-lg overflow-hidden">
                  {listing.image_url ? (
                    <img 
                      src={listing.image_url} 
                      alt={listing.title}
                      className="object-cover w-full h-full"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = DEFAULT_IMAGE;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </AspectRatio>
                {listing.image_url && (
                  <div className="mt-2">
                    <a 
                      href={listing.image_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View original
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
              
              {/* Details */}
              <div className="md:col-span-2">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm mb-1">Description:</h4>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {listing.description}
                    </p>
                  </div>
                  
                  {listing.tags && listing.tags.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-1">Tags:</h4>
                      <div className="flex flex-wrap gap-1">
                        {listing.tags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {listing.owner_notes && (
                    <div>
                      <h4 className="font-medium text-sm mb-1">Owner Notes:</h4>
                      <p className="text-sm text-muted-foreground italic">
                        {listing.owner_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
