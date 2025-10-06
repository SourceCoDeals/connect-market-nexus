import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, Building2, User, Link as LinkIcon, FileText, Mail, Edit, Users } from "lucide-react";
import { StatusTagSwitcher } from "@/components/admin/StatusTagSwitcher";
import { useAdminListings } from "@/hooks/admin/use-admin-listings";
import { Listing } from "@/types";
import { Badge } from "@/components/ui/badge";

interface AdminListingSidebarProps {
  listing: Listing;
  onUserViewToggle: (enabled: boolean) => void;
  userViewEnabled: boolean;
  onEditModeToggle: (enabled: boolean) => void;
  editModeEnabled: boolean;
}

export function AdminListingSidebar({ 
  listing, 
  onUserViewToggle, 
  userViewEnabled,
  onEditModeToggle,
  editModeEnabled
}: AdminListingSidebarProps) {
  const { useUpdateListing } = useAdminListings();
  const { mutate: updateListing } = useUpdateListing();
  
  const handleStatusChange = (newStatus: string | null) => {
    updateListing({
      id: listing.id,
      listing: {
        status_tag: newStatus,
      },
    });
  };

  return (
    <div className="sticky top-6 space-y-4">
      {/* View Controls */}
      <div className="bg-white border border-sourceco-form rounded-lg p-4 shadow-sm space-y-3">
        {/* User View Toggle */}
        <div className="flex items-center justify-between pb-3 border-b border-sourceco-form">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-600" />
            <Label htmlFor="user-view" className="text-sm font-medium text-slate-900 cursor-pointer">
              User View
            </Label>
          </div>
          <Switch
            id="user-view"
            checked={userViewEnabled}
            onCheckedChange={onUserViewToggle}
          />
        </div>

        {/* Edit Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit className="h-4 w-4 text-slate-600" />
            <Label htmlFor="edit-mode" className="text-sm font-medium text-slate-900 cursor-pointer">
              Edit Mode
            </Label>
          </div>
          <Switch
            id="edit-mode"
            checked={editModeEnabled}
            onCheckedChange={onEditModeToggle}
          />
        </div>
      </div>

      {/* Status Tag Control */}
      <div className="bg-white border border-sourceco-form rounded-lg p-4 shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-900">Listing Status</h3>
          </div>
          <StatusTagSwitcher
            currentValue={listing.status_tag || null}
            onChange={handleStatusChange}
            className="w-full"
          />
        </div>
      </div>

      {/* Buyer Visibility Control */}
      <div className="bg-white border border-sourceco-form rounded-lg p-4 shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-900">Visible To</h3>
          </div>
          
          {!listing.visible_to_buyer_types || listing.visible_to_buyer_types.length === 0 ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                🌐 All Buyer Types
              </Badge>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Restricted to {listing.visible_to_buyer_types.length} buyer type{listing.visible_to_buyer_types.length > 1 ? 's' : ''}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {listing.visible_to_buyer_types.map((type) => {
                  const labels: Record<string, string> = {
                    privateEquity: 'Private Equity',
                    corporate: 'Corporate',
                    familyOffice: 'Family Office',
                    searchFund: 'Search Fund',
                    individual: 'Individual',
                    independentSponsor: 'Independent Sponsor',
                    advisor: 'Advisor',
                    businessOwner: 'Business Owner'
                  };
                  return (
                    <Badge 
                      key={type} 
                      variant="outline" 
                      className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                    >
                      {labels[type] || type}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Internal Company Information */}
      {(listing.internal_company_name || 
        listing.internal_primary_owner || 
        listing.internal_contact_info ||
        listing.internal_salesforce_link ||
        listing.internal_deal_memo_link) && (
        <div className="bg-white border border-sourceco-form rounded-lg p-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">Internal Information</h3>
            </div>
            
            <div className="space-y-3 text-xs">
              {listing.internal_company_name && (
                <div>
                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                    <Building2 className="h-3 w-3" />
                    <span className="font-medium">Company Name</span>
                  </div>
                  <p className="text-slate-900 pl-4">{listing.internal_company_name}</p>
                </div>
              )}
              
              {listing.internal_primary_owner && (
                <div>
                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                    <User className="h-3 w-3" />
                    <span className="font-medium">Primary Owner</span>
                  </div>
                  <p className="text-slate-900 pl-4">{listing.internal_primary_owner}</p>
                </div>
              )}
              
              {listing.internal_contact_info && (
                <div>
                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                    <Mail className="h-3 w-3" />
                    <span className="font-medium">Contact Info</span>
                  </div>
                  <p className="text-slate-900 pl-4 break-words">{listing.internal_contact_info}</p>
                </div>
              )}
              
              {listing.internal_salesforce_link && (
                <div>
                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                    <LinkIcon className="h-3 w-3" />
                    <span className="font-medium">Salesforce</span>
                  </div>
                  <a 
                    href={listing.internal_salesforce_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sourceco-accent hover:underline pl-4 block break-all"
                  >
                    View in Salesforce →
                  </a>
                </div>
              )}
              
              {listing.internal_deal_memo_link && (
                <div>
                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                    <FileText className="h-3 w-3" />
                    <span className="font-medium">Deal Memo</span>
                  </div>
                  <a 
                    href={listing.internal_deal_memo_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sourceco-accent hover:underline pl-4 block break-all"
                  >
                    View Deal Memo →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-sourceco-background border border-sourceco-form rounded-lg p-3">
        <p className="text-xs text-slate-600">
          {editModeEnabled 
            ? "Edit mode active: Click any content to edit directly on the page." 
            : "Toggle Edit Mode to make changes to this listing."}
        </p>
      </div>
    </div>
  );
}
