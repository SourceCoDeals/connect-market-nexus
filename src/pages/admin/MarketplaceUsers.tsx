import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
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

const MarketplaceUsers = () => {
  const { users } = useAdmin();
  const { data: usersData = [], isLoading, error, refetch } = users;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isConnected } = useRealtimeAdmin();
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const { markAsViewed: markUsersAsViewed } = useMarkUsersViewed();

  useEffect(() => {
    markUsersAsViewed();
  }, []);

  useEffect(() => {
    setFilteredUsers(usersData);
  }, [usersData]);

  const {
    handleUserApproval,
    handleMakeAdmin,
    handleRevokeAdmin,
    handleDeleteUser,
    ApprovalEmailDialog,
    AdminDialog,
    RevokeAdminDialog,
    DeleteDialog,
    isLoading: isActionLoading,
  } = UserActions({ onUserStatusUpdated: () => refetch() });

  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Error loading users",
        description: "Failed to load user data. Please try refreshing the page.",
      });
    }
  }, [error, toast]);

  const handleRetry = () => {
    refetch();
    toast({
      title: "Refreshing data",
      description: "Reloading user data...",
    });
  };

  const approveUser = (user: User) => handleUserApproval(user);
  const makeAdmin = (user: User) => handleMakeAdmin(user);
  const revokeAdmin = (user: User) => handleRevokeAdmin(user);
  const deleteUser = (user: User) => handleDeleteUser(user);

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-xl md:text-2xl font-bold mb-2">Error Loading Users</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-md text-sm md:text-base">
            There was an error loading marketplace user data.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Marketplace Users</h1>
            <p className="text-sm text-muted-foreground">
              PE firms registered on the marketplace. Manage approvals, access, and profile data.
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
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

export default MarketplaceUsers;
