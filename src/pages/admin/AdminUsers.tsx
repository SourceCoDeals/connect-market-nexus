
import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { MobileUsersTable } from "@/components/admin/MobileUsersTable";
import { User } from "@/types";
import { UserActions } from "@/components/admin/UserActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeAdmin } from "@/hooks/use-realtime-admin";
import { cn } from "@/lib/utils";
import { EnhancedUserManagement } from "@/components/admin/EnhancedUserManagement";
import { UserProfileCompletion } from "@/components/admin/UserProfileCompletion";



const AdminUsers = () => {
  const { users } = useAdmin();
  const { data: usersData = [], isLoading, error, refetch } = users;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isConnected } = useRealtimeAdmin(); // Enable real-time updates
  
  const [searchQuery, setSearchQuery] = useState("");
  
  // Memoize user action handlers to prevent recreation on every render
  const userActions = useMemo(() => {
    return UserActions({ onUserStatusUpdated: () => refetch() });
  }, [refetch]);
  
  const {
    handleUserApproval,
    handleUserRejection,
    handleMakeAdmin,
    handleRevokeAdmin,
    handleDeleteUser,
    ApprovalEmailDialog,
    RejectionDialog,
    AdminDialog,
    RevokeAdminDialog,
    DeleteDialog,
    isLoading: isActionLoading
  } = userActions;
  
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
  
  // Enhanced search functionality
  const filteredUsers = usersData.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.company?.toLowerCase().includes(searchLower) ||
      user.buyer_type?.toLowerCase().includes(searchLower) ||
      user.approval_status?.toLowerCase().includes(searchLower)
    );
  });

  // Enhanced statistics
  const stats = {
    total: usersData.length,
    pending: usersData.filter((u) => u.approval_status === "pending").length,
    approved: usersData.filter((u) => u.approval_status === "approved").length,
    rejected: usersData.filter((u) => u.approval_status === "rejected").length,
    admins: usersData.filter((u) => u.is_admin).length,
    emailVerified: usersData.filter((u) => u.email_verified).length,
  };

  // User action handlers
  const approveUser = (user: User) => handleUserApproval(user);
  const rejectUser = (user: User) => handleUserRejection(user);
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
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Enhanced User Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Comprehensive user management with analytics and profile completion tracking
          </p>
        </div>
      </div>


      {/* Enhanced User Management with Analytics */}
      <EnhancedUserManagement
        users={usersData}
        onApprove={approveUser}
        onReject={rejectUser}
        onMakeAdmin={makeAdmin}
        onRevokeAdmin={revokeAdmin}
        onDelete={deleteUser}
        isLoading={isLoading}
      />

      {/* Priority Alert */}
      {stats.pending > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-900">Action Required</AlertTitle>
          <AlertDescription className="text-orange-800">
            You have {stats.pending} users waiting for approval.
          </AlertDescription>
        </Alert>
      )}

      {/* Search Results Info */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          Found {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </div>
      )}

      {/* Users Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {isMobile ? (
          <div className="p-2 md:p-4">
            <MobileUsersTable
              users={filteredUsers}
              onApprove={approveUser}
              onReject={rejectUser}
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
              onReject={rejectUser}
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
      <RejectionDialog />
      <AdminDialog />
      <RevokeAdminDialog />
      <DeleteDialog />
    </div>
  );
};

function StatsCard({ 
  title, 
  value, 
  className 
}: { 
  title: string; 
  value: number; 
  className?: string 
}) {
  return (
    <Card className={cn("p-3 md:p-4", className)}>
      <CardContent className="p-0">
        <div className="text-xs md:text-sm font-medium opacity-80">{title}</div>
        <div className="text-lg md:text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default AdminUsers;
