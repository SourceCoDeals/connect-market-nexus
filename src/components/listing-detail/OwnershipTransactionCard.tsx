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
    <div className="border border-slate-200 bg-white p-6 space-y-6">
      {/* Header */}
      <span className="document-label">Ownership & Transaction</span>
      
      {/* Current Ownership */}
      <div className="space-y-3">
        <span className="document-label">Current Structure</span>
        <div className="space-y-2">
          {listing.ownership_structure && (
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Type</span>
              <span className="text-xs font-medium capitalize">
                {listing.ownership_structure.replace('_', ' ')}
              </span>
            </div>
          )}
          {listing.management_depth && (
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Management</span>
              <span className="text-xs font-medium capitalize">
                {listing.management_depth.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Seller Motivation */}
      {listing.seller_motivation && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <span className="document-label">Seller Motivation</span>
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Primary Reason</span>
            <span className="text-xs font-medium capitalize">
              {listing.seller_motivation.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Transaction Preferences */}
      {(listing.seller_involvement_preference || listing.timeline_preference || listing.transaction_preferences) && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <span className="document-label">Transaction Preferences</span>
          
          <div className="space-y-2">
            {listing.timeline_preference && (
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Timeline</span>
                <span className="text-xs font-medium capitalize">
                  {listing.timeline_preference.replace('_', ' ')}
                </span>
              </div>
            )}
            
            {listing.seller_involvement_preference && (
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Post-Sale Role</span>
                <span className="text-xs font-medium capitalize">
                  {listing.seller_involvement_preference.replace('_', ' ')}
                </span>
              </div>
            )}

            {listing.transaction_preferences && Object.keys(listing.transaction_preferences).length > 0 && (
              <div className="space-y-2">
                {Object.entries(listing.transaction_preferences).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-xs text-slate-500 capitalize">{key.replace('_', ' ')}</span>
                    <span className="text-xs font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Considerations */}
      <div className="bg-slate-50 p-4 space-y-2">
        <span className="document-label">Key Considerations</span>
        <div className="space-y-1">
          <div className="text-xs text-slate-600">• Management transition and retention</div>
          <div className="text-xs text-slate-600">• Cultural fit and operational continuity</div>
          <div className="text-xs text-slate-600">• Seller financing and earn-out structures</div>
          <div className="text-xs text-slate-600">• Integration timeline and synergies</div>
        </div>
      </div>
    </div>
  );
}