import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, Building2, User, Link as LinkIcon, FileText, Mail, Edit, Users } from "lucide-react";
import { StatusTagSwitcher } from "@/components/admin/StatusTagSwitcher";
import { useAdminListings } from "@/hooks/admin/use-admin-listings";
import { Listing } from "@/types";

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
    <div className="sticky top-6 space-y-6">
      {/* View Controls - Always visible to admins */}
      {!userViewEnabled && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60 space-y-4">
          {/* User View Toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Eye className="h-4 w-4 text-slate-500" />
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
            <div className="flex items-center gap-2.5">
              <Edit className="h-4 w-4 text-slate-500" />
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
      )}

      {/* Status Tag Control - Hide in user view */}
      {!userViewEnabled && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Listing Status</h3>
            </div>
            <StatusTagSwitcher
              currentValue={listing.status_tag || null}
              onChange={handleStatusChange}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Buyer Visibility Control - Hide in user view */}
      {!userViewEnabled && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <Users className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Buyer Visibility</h3>
            </div>
            
            <div className="space-y-3 text-sm">
              {!listing.visible_to_buyer_types || listing.visible_to_buyer_types.length === 0 ? (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium">Visibility</span>
                  </div>
                  <p className="text-slate-900 pl-5">All Buyer Types 🌐</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium">Visible To</span>
                  </div>
                  <div className="pl-5 space-y-1">
                    {listing.visible_to_buyer_types.map((type, index) => (
                      <p key={index} className="text-slate-900">
                        {type === 'searcher' && '🔍 Searchers'}
                        {type === 'independent_sponsor' && '💼 Independent Sponsors'}
                        {type === 'family_office' && '🏛️ Family Offices'}
                        {type === 'private_equity' && '📈 Private Equity'}
                        {type === 'strategic' && '🎯 Strategic Buyers'}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Internal Information */}
      {!userViewEnabled && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200/60">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <Building2 className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Internal Information</h3>
            </div>

            <div className="space-y-4 text-sm">
              {listing.internal_company_name && (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="font-medium">Company</span>
                  </div>
                  <p className="text-slate-900 pl-5 break-words">{listing.internal_company_name}</p>
                </div>
              )}

              {listing.internal_primary_owner && (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium">Owner</span>
                  </div>
                  <p className="text-slate-900 pl-5 break-words">{listing.internal_primary_owner}</p>
                </div>
              )}

              {listing.internal_contact_info && (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="font-medium">Contact</span>
                  </div>
                  <p className="text-slate-900 pl-5 break-words text-xs">{listing.internal_contact_info}</p>
                </div>
              )}

              {listing.internal_salesforce_link && (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                    <LinkIcon className="h-3.5 w-3.5" />
                    <span className="font-medium">Salesforce</span>
                  </div>
                  <a 
                    href={listing.internal_salesforce_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline pl-5 break-all text-xs"
                  >
                    View in Salesforce
                  </a>
                </div>
              )}

              {listing.internal_deal_memo_link && (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="font-medium">Deal Memo</span>
                  </div>
                  <a 
                    href={listing.internal_deal_memo_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline pl-5 break-all text-xs"
                  >
                    View Deal Memo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode Help Text */}
      {!userViewEnabled && editModeEnabled && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-blue-900 leading-relaxed">
            <strong className="font-semibold">Edit Mode Active:</strong> Click on any text field to edit it directly. Changes are saved automatically.
          </p>
        </div>
      )}
    </div>
  );
}
