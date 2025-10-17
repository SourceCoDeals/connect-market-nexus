
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "@/hooks/use-admin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, AlertCircle, RefreshCw, Building2 } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { MobileUsersTable } from "@/components/admin/MobileUsersTable";
import { User } from "@/types";
import { UserActions } from "@/components/admin/UserActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeAdmin } from "@/hooks/use-realtime-admin";
import { EnhancedUserManagement } from "@/components/admin/EnhancedUserManagement";
import { BulkVerificationEmailSender } from "@/components/admin/BulkVerificationEmailSender";
import { ProfileDataInspector } from "@/components/admin/ProfileDataInspector";
import { ProfileDataRecovery } from "@/components/admin/ProfileDataRecovery";
import { AutomatedDataRestoration } from "@/components/admin/AutomatedDataRestoration";



const AdminUsers = () => {
  const { users } = useAdmin();
  const { data: usersData = [], isLoading, error, refetch } = users;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isConnected } = useRealtimeAdmin(); // Enable real-time updates
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  // Update filtered users when usersData changes
  useEffect(() => {
    setFilteredUsers(usersData);
  }, [usersData]);
  
  
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Enhanced User Management</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Comprehensive user management with analytics and profile completion tracking
            </p>
          </div>
          <Link to="/admin/firm-agreements">
            <Button variant="outline" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Firm Agreement Tracking</span>
              <span className="sm:hidden">Firms</span>
            </Button>
          </Link>
        </div>
      </div>


      {/* Enhanced User Management with Analytics */}
      <EnhancedUserManagement
        users={usersData}
        onApprove={approveUser}
        onMakeAdmin={makeAdmin}
        onRevokeAdmin={revokeAdmin}
        onDelete={deleteUser}
        isLoading={isLoading}
        onFilteredUsersChange={setFilteredUsers}
      />


      {/* Users Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {isMobile ? (
          <div className="p-2 md:p-4">
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

      {/* All user action dialogs */}
      <ApprovalEmailDialog />
      <AdminDialog />
      <RevokeAdminDialog />
      <DeleteDialog />

      {/* Edge Case Tools - Placed at bottom since rarely used */}
      <div className="mt-8 border-t pt-6 space-y-4">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <span>🔧 Edge Case Tools (Rarely Used)</span>
            <span className="group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-4 space-y-4">
            {/* NEW: Automated Data Restoration (smart fix for over-standardized data) */}
            <AutomatedDataRestoration />
            <BulkVerificationEmailSender />
            {/* New: Profile Data Inspector (compares current vs raw snapshots) */}
            <ProfileDataInspector />
            {/* New: Profile Data Recovery (restore over-standardized data) */}
            <ProfileDataRecovery />
          </div>
        </details>
      </div>
    </div>
  );
};


export default AdminUsers;
