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
    <div className="space-y-6">
      
      {/* Header */}
      <h3 className="document-title">Transaction Structure</h3>
      
      {/* Current Ownership */}
      <div className="space-y-3">
        <span className="document-label">Current Ownership</span>
        <div className="space-y-2">
          {listing.ownership_structure && (
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Structure</span>
              <span className="text-sm capitalize">{listing.ownership_structure.replace('_', ' ')}</span>
            </div>
          )}
          {listing.management_depth && (
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Management</span>
              <span className="text-sm capitalize">{listing.management_depth.replace('_', ' ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Seller Motivation */}
      {listing.seller_motivation && (
        <div className="space-y-3">
          <span className="document-label">Seller Motivation</span>
          <div className="text-sm capitalize">{listing.seller_motivation.replace('_', ' ')}</div>
        </div>
      )}

      {/* Transaction Preferences */}
      {(listing.seller_involvement_preference || listing.timeline_preference || listing.transaction_preferences) && (
        <div className="space-y-3">
          <span className="document-label">Transaction Preferences</span>
          
          <div className="space-y-2">
            {listing.timeline_preference && (
              <div className="flex justify-between items-center">
                <span className="document-subtitle">Timeline</span>
                <span className="text-sm capitalize">{listing.timeline_preference.replace('_', ' ')}</span>
              </div>
            )}
            
            {listing.seller_involvement_preference && (
              <div className="flex justify-between items-center">
                <span className="document-subtitle">Post-Sale Role</span>
                <span className="text-sm capitalize">{listing.seller_involvement_preference.replace('_', ' ')}</span>
              </div>
            )}

            {listing.transaction_preferences && Object.keys(listing.transaction_preferences).length > 0 && (
              <div className="space-y-2">
                <span className="document-subtitle">Deal Structure</span>
                <div className="space-y-1">
                  {Object.entries(listing.transaction_preferences).map(([key, value]) => (
                    <div key={key} className="text-xs text-muted-foreground">
                      {key.replace('_', ' ')}: {String(value)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Considerations */}
      <div className="space-y-3 border-t border-section-border pt-4">
        <span className="document-label">Due Diligence Considerations</span>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>• Management transition and retention requirements</div>
          <div>• Cultural integration and operational continuity</div>
          <div>• Seller financing and earn-out opportunities</div>
          <div>• Integration timeline and synergy realization</div>
        </div>
      </div>
    </div>
  );
}