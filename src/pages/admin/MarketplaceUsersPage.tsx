import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "@/hooks/use-admin";
import { AlertCircle, RefreshCw, Building2, Loader2, Users } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { MobileUsersTable } from "@/components/admin/MobileUsersTable";
import { User } from "@/types";
import { UserActions } from "@/components/admin/UserActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeAdmin } from "@/hooks/use-realtime-admin";
import { EnhancedUserManagement } from "@/components/admin/EnhancedUserManagement";
import { useMarkUsersViewed } from "@/hooks/admin/use-mark-users-viewed";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MarketplaceUsersPage = () => {
  const { users } = useAdmin();
  const { data: usersData = [], isLoading, error, refetch } = users;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isConnected } = useRealtimeAdmin();
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const { markAsViewed } = useMarkUsersViewed();

  // Query remarketing buyers that have a marketplace_firm_id link
  const { data: linkedBuyerCount = 0 } = useQuery({
    queryKey: ['remarketing-buyers-marketplace-linked-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('remarketing_buyers')
        .select('id', { count: 'exact', head: true })
        .not('marketplace_firm_id', 'is', null);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  useEffect(() => { markAsViewed(); }, []);
  useEffect(() => { setFilteredUsers(usersData); }, [usersData]);

  const {
    handleUserApproval,
    handleMakeAdmin,
    handleRevokeAdmin,
    handleDeleteUser,
    ApprovalEmailDialog,
    AdminDialog,
    RevokeAdminDialog,
    DeleteDialog,
  } = UserActions({ onUserStatusUpdated: () => refetch() });

  const approveUser = (user: User) => handleUserApproval(user);
  const makeAdmin = (user: User) => handleMakeAdmin(user);
  const revokeAdmin = (user: User) => handleRevokeAdmin(user);
  const deleteUser = (user: User) => handleDeleteUser(user);

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Error Loading Users</h2>
        <Button onClick={() => refetch()} className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Marketplace Users</h1>
              <p className="text-sm text-muted-foreground">Manage buyer registrations, approvals, and profile data</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        {linkedBuyerCount > 0 && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <Users className="h-4 w-4 shrink-0" />
            <span>
              <strong>{linkedBuyerCount}</strong> remarketing {linkedBuyerCount === 1 ? 'buyer' : 'buyers'} linked to marketplace firms.{' '}
              <Link to="/admin/buyers" className="underline font-medium hover:text-blue-900">View All Buyers</Link>
            </span>
          </div>
        )}

        <div className="mb-6">
          <EnhancedUserManagement
            users={usersData}
            onApprove={approveUser}
            onMakeAdmin={makeAdmin}
            onRevokeAdmin={revokeAdmin}
            onDelete={deleteUser}
            isLoading={isLoading}
            onFilteredUsersChange={setFilteredUsers}
          />
        </div>

        <div className="bg-card rounded-lg border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isMobile ? (
            <div className="p-4">
              <MobileUsersTable
                users={filteredUsers}
                onApprove={approveUser}
                onMakeAdmin={makeAdmin}
                onRevokeAdmin={revokeAdmin}
                onDelete={deleteUser}
                isLoading={isLoading}
                onSendFeeAgreement={() => {}}
                onSendNDAEmail={() => {}}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <UsersTable
                users={filteredUsers}
                onApprove={approveUser}
                onMakeAdmin={makeAdmin}
                onRevokeAdmin={revokeAdmin}
                onDelete={deleteUser}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>

        <ApprovalEmailDialog />
        <AdminDialog />
        <RevokeAdminDialog />
        <DeleteDialog />
      </div>
    </div>
  );
};

export default MarketplaceUsersPage;
