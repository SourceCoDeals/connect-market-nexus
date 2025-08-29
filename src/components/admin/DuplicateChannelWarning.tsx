import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface DuplicateChannelWarningProps {
  sourceMetadata?: Record<string, any>;
  className?: string;
}

export const DuplicateChannelWarning = ({ sourceMetadata, className }: DuplicateChannelWarningProps) => {
  if (!sourceMetadata?.is_channel_duplicate) {
    return null;
  }

  const isWebsiteToMarketplace = sourceMetadata.channel_merge === 'website_to_marketplace';
  const isMarketplaceToWebsite = sourceMetadata.channel_merge === 'marketplace_to_website';
  const mergedAt = sourceMetadata.merged_at ? new Date(sourceMetadata.merged_at).toLocaleDateString() : null;

  return (
    <Card className={`border-amber-200 bg-amber-50/80 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-amber-800">Multiple Channel Request</h4>
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                <RefreshCw className="h-3 w-3 mr-1" />
                Merged
              </Badge>
            </div>
            
            <div className="text-sm text-amber-700">
              {isWebsiteToMarketplace && (
                <p>
                  This person first submitted via <strong>website</strong>, then later requested access through the <strong>marketplace</strong>. 
                  The requests have been automatically merged.
                </p>
              )}
              {isMarketplaceToWebsite && (
                <p>
                  This person first requested via <strong>marketplace</strong>, then a lead was later imported from the <strong>website</strong>. 
                  The lead has been linked to the existing request.
                </p>
              )}
              {mergedAt && (
                <>
                  <Separator className="my-2 bg-amber-200" />
                  <p className="text-xs text-amber-600">
                    Merged on {mergedAt}
                    {sourceMetadata.original_lead_email && (
                      <span className="ml-2">• Original lead email: {sourceMetadata.original_lead_email}</span>
                    )}
                    {sourceMetadata.linked_lead_id && (
                      <span className="ml-2">• Linked lead ID: {sourceMetadata.linked_lead_id}</span>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};