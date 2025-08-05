
import { useEffect } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { MobileUsersTable } from "@/components/admin/MobileUsersTable";
import { User } from "@/types";
import { UserActions } from "@/components/admin/UserActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeAdmin } from "@/hooks/use-realtime-admin";
import { EnhancedUserManagement } from "@/components/admin/EnhancedUserManagement";



const AdminUsers = () => {
  const { users } = useAdmin();
  const { data: usersData = [], isLoading, error, refetch } = users;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isConnected } = useRealtimeAdmin();
  
  // Get user action handlers from the hook
  const {
    handleUserApproval,
    handleMakeAdmin,
    handleRevokeAdmin,
    handleDeleteUser,
    ApprovalEmailDialog,
    AdminDialog,
    RevokeAdminDialog,
    DeleteDialog,
    isLoading: isActionLoading
  } = UserActions({ onUserStatusUpdated: () => refetch() });
  
  // Handle errors and show user feedback
  useEffect(() => {
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error loading users',
        description: 'Failed to load user data. Please try refreshing the page.',
      });
    }
  }, [error, toast]);
  
  const handleRetry = () => {
    refetch();
    toast({
      title: 'Refreshing data',
      description: 'Reloading user data...',
    });
  };

  // User action handlers
  const approveUser = (user: User) => handleUserApproval(user);
  const makeAdmin = (user: User) => handleMakeAdmin(user);
  const revokeAdmin = (user: User) => handleRevokeAdmin(user);
  const deleteUser = (user: User) => handleDeleteUser(user);

  // Stats for priority alerts
  const pendingCount = usersData.filter((u) => u.approval_status === "pending").length;

  // Error state with better UX
  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-xl md:text-2xl font-bold mb-2">Error Loading Users</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-md text-sm md:text-base">
            There was an error loading the user data. This might be due to a database connection issue or permissions problem.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold">User Management</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage users, approvals, and send documents
        </p>
      </div>

      {/* Priority Alert */}
      {pendingCount > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-900">Action Required</AlertTitle>
          <AlertDescription className="text-orange-800">
            You have {pendingCount} users waiting for approval.
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced User Management - handles search and filtering internally */}
      <EnhancedUserManagement
        users={usersData}
        onApprove={approveUser}
        onMakeAdmin={makeAdmin}
        onRevokeAdmin={revokeAdmin}
        onDelete={deleteUser}
        isLoading={isLoading}
      />

      {/* All user action dialogs */}
      <ApprovalEmailDialog />
      <AdminDialog />
      <RevokeAdminDialog />
      <DeleteDialog />
    </div>
  );
};


export default AdminUsers;
