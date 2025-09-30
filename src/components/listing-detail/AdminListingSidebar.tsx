import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, Building2, User, Link as LinkIcon, FileText, Mail } from "lucide-react";
import { StatusTagSwitcher } from "@/components/admin/StatusTagSwitcher";
import { useAdminListings } from "@/hooks/admin/use-admin-listings";
import { Listing } from "@/types";

interface AdminListingSidebarProps {
  listing: Listing;
  onUserViewToggle: (enabled: boolean) => void;
  userViewEnabled: boolean;
}

export function AdminListingSidebar({ 
  listing, 
  onUserViewToggle, 
  userViewEnabled 
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
      {/* User View Toggle */}
      <div className="bg-white border border-sourceco-form rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
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
        <p className="text-xs text-slate-600 mt-2">
          Preview how this listing appears to buyers
        </p>
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

      {/* Quick Actions */}
      <div className="bg-white border border-sourceco-form rounded-lg p-4 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h3>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => window.open(`/admin/listings/edit/${listing.id}`, '_blank')}
          >
            Edit in Admin Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
