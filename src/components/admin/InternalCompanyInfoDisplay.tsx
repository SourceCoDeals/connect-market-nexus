import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Building, User, Link as LinkIcon, FileText, Clipboard, ExternalLink } from "lucide-react";
import { AdminListing } from "@/types/admin";

interface InternalCompanyInfoDisplayProps {
  listing: AdminListing;
}

export function InternalCompanyInfoDisplay({ listing }: InternalCompanyInfoDisplayProps) {
  // Only show if there's any internal information
  const hasInternalInfo = listing.deal_identifier || 
    listing.internal_company_name || 
    listing.internal_primary_owner || 
    listing.internal_salesforce_link || 
    listing.internal_deal_memo_link || 
    listing.internal_contact_info || 
    listing.internal_notes;

  if (!hasInternalInfo) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/20 mt-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-orange-700 dark:text-orange-400">
          <Shield className="h-5 w-5" />
          Internal Company Information
          <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
            Admin Only
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Deal Identifier */}
        {listing.deal_identifier && (
          <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-orange-200 dark:border-orange-800">
            <Clipboard className="h-5 w-5 text-orange-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm text-orange-700 dark:text-orange-400">Deal ID</div>
              <code className="text-sm font-mono text-orange-800 dark:text-orange-200">
                {listing.deal_identifier}
              </code>
            </div>
          </div>
        )}

        {/* Company Name & Primary Owner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listing.internal_company_name && (
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-orange-700 dark:text-orange-400">Real Company Name</div>
                <div className="text-sm text-gray-700 dark:text-gray-300">{listing.internal_company_name}</div>
              </div>
            </div>
          )}

          {listing.internal_primary_owner && (
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-orange-700 dark:text-orange-400">Primary Owner</div>
                <div className="text-sm text-gray-700 dark:text-gray-300">{listing.internal_primary_owner}</div>
              </div>
            </div>
          )}
        </div>

        {/* Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listing.internal_salesforce_link && (
            <div className="flex items-start gap-3">
              <LinkIcon className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-sm text-orange-700 dark:text-orange-400">Salesforce</div>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="p-0 h-auto text-blue-600 hover:text-blue-800 text-sm"
                  onClick={() => window.open(listing.internal_salesforce_link, '_blank')}
                >
                  Open in Salesforce
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {listing.internal_deal_memo_link && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-sm text-orange-700 dark:text-orange-400">Deal Memo</div>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="p-0 h-auto text-blue-600 hover:text-blue-800 text-sm"
                  onClick={() => window.open(listing.internal_deal_memo_link, '_blank')}
                >
                  View Deal Memo
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Contact Info */}
        {listing.internal_contact_info && (
          <div>
            <div className="font-medium text-sm text-orange-700 dark:text-orange-400 mb-2">Contact Information</div>
            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-orange-200 dark:border-orange-800 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {listing.internal_contact_info}
            </div>
          </div>
        )}

        {/* Internal Notes */}
        {listing.internal_notes && (
          <div>
            <div className="font-medium text-sm text-orange-700 dark:text-orange-400 mb-2">Internal Notes</div>
            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-orange-200 dark:border-orange-800 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {listing.internal_notes}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}