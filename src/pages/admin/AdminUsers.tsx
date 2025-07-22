
import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { MobileUsersTable } from "@/components/admin/MobileUsersTable";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { UserActions } from "@/components/admin/UserActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const AdminUsers = () => {
  const { users } = useAdmin();
  const { data: usersData = [], isLoading, error, refetch } = users;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [searchQuery, setSearchQuery] = useState("");
  
  // Get user action handlers from the component
  const {
    handleUserApproval,
    handleUserRejection,
    handleMakeAdmin,
    handleRevokeAdmin,
    handleDeleteUser,
    confirmAction,
    isDialogOpen,
    setIsDialogOpen,
    selectedUser,
    actionType,
    isLoading: isActionLoading
  } = UserActions({ onUserStatusUpdated: refetch });
  
  // Handle errors and show user feedback
  useEffect(() => {
    if (error) {
      console.error('❌ Admin users error:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading users',
        description: 'Failed to load user data. Please try refreshing the page.',
      });
    }
  }, [error, toast]);
  
  const handleRetry = () => {
    console.log('🔄 Retrying user data fetch...');
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
  const approveUser = (user: any) => handleUserApproval(user);
  const rejectUser = (user: any) => handleUserRejection(user);
  const makeAdmin = (user: any) => handleMakeAdmin(user);
  const revokeAdmin = (user: any) => handleRevokeAdmin(user);
  const deleteUser = (user: any) => handleDeleteUser(user);

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
          <h1 className="text-2xl md:text-3xl font-bold">User Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search users by email, name, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Button
            onClick={handleRetry}
            variant="outline"
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
        <StatsCard 
          title="Total" 
          value={stats.total} 
          className="bg-blue-50 text-blue-900"
        />
        <StatsCard 
          title="Pending" 
          value={stats.pending} 
          className="bg-yellow-50 text-yellow-900"
        />
        <StatsCard 
          title="Approved" 
          value={stats.approved} 
          className="bg-green-50 text-green-900"
        />
        <StatsCard 
          title="Rejected" 
          value={stats.rejected} 
          className="bg-red-50 text-red-900"
        />
        <StatsCard 
          title="Admins" 
          value={stats.admins} 
          className="bg-purple-50 text-purple-900"
        />
        <StatsCard 
          title="Verified" 
          value={stats.emailVerified} 
          className="bg-indigo-50 text-indigo-900"
        />
      </div>

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

      <UserDetailDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={confirmAction}
        selectedUser={selectedUser}
        actionType={actionType}
        isLoading={isActionLoading}
      />
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
