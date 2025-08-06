import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Users, Clock, Target, HandHeart } from "lucide-react";
import { AdminListing } from "@/types/admin";

interface OwnershipTransactionCardProps {
  listing: AdminListing;
}

export function OwnershipTransactionCard({ listing }: OwnershipTransactionCardProps) {
  const getOwnershipIcon = (type?: string) => {
    switch (type) {
      case 'individual':
        return <Users className="h-4 w-4" />;
      case 'family':
        return <HandHeart className="h-4 w-4" />;
      case 'corporate':
        return <Building2 className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  const getMotivationColor = (motivation?: string) => {
    switch (motivation) {
      case 'retirement':
        return 'secondary';
      case 'succession':
        return 'outline';
      case 'growth_capital':
        return 'default';
      case 'liquidity_event':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getManagementBadgeColor = (depth?: string) => {
    switch (depth) {
      case 'succession_ready':
        return 'default';
      case 'management_team':
        return 'secondary';
      case 'owner_operated':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Ownership & Transaction
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Ownership */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            {getOwnershipIcon(listing.ownership_structure)}
            Current Ownership
          </h4>
          <div className="flex flex-wrap gap-2">
            {listing.ownership_structure && (
              <Badge variant="outline" className="capitalize">
                {listing.ownership_structure.replace('_', ' ')}
              </Badge>
            )}
            {listing.management_depth && (
              <Badge variant={getManagementBadgeColor(listing.management_depth)}>
                {listing.management_depth.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Seller Motivation */}
        {listing.seller_motivation && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Seller Motivation</h4>
            <Badge variant={getMotivationColor(listing.seller_motivation)} className="capitalize">
              {listing.seller_motivation.replace('_', ' ')}
            </Badge>
          </div>
        )}

        {/* Transaction Preferences */}
        {(listing.seller_involvement_preference || listing.timeline_preference || listing.transaction_preferences) && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Transaction Preferences
              </h4>
              
              <div className="grid grid-cols-1 gap-3">
                {listing.timeline_preference && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Timeline</span>
                    <Badge variant="outline" className="capitalize">
                      {listing.timeline_preference.replace('_', ' ')}
                    </Badge>
                  </div>
                )}
                
                {listing.seller_involvement_preference && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Post-Sale Involvement</span>
                    <Badge variant="secondary" className="capitalize">
                      {listing.seller_involvement_preference.replace('_', ' ')}
                    </Badge>
                  </div>
                )}

                {listing.transaction_preferences && Object.keys(listing.transaction_preferences).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Deal Structure</span>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(listing.transaction_preferences).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key.replace('_', ' ')}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Key Considerations */}
        <div className="bg-primary/5 rounded-lg p-4 space-y-2">
          <h5 className="font-medium text-sm text-primary">Key Considerations</h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Management transition and retention requirements</li>
            <li>• Cultural fit and operational continuity</li>
            <li>• Seller financing and earn-out opportunities</li>
            <li>• Integration timeline and synergy realization</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}