import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, Edit } from "lucide-react";
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

      {/* Edit Mode Help Text */}
      {editModeEnabled && !userViewEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Edit Mode Active:</span> Click on any field to edit it directly.
          </p>
        </div>
      )}
    </div>
  );
}
