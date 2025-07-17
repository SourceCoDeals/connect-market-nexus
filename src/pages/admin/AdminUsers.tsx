
import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, AlertCircle, RefreshCw, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { UserActions } from "@/components/admin/UserActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AdminUsers = () => {
  const { users } = useAdmin();
  const { data: usersData = [], isLoading, error, refetch } = users;
  const { toast } = useToast();
  
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

  // Error state with better UX
  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Error Loading Users</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            There was an error loading the user data. This might be due to a database connection issue or permissions problem.
          </p>
          <div className="flex gap-2">
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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">User Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search users..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            onClick={handleRetry}
            variant="outline"
            size="icon"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Total</span>
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <div className="text-2xl font-bold">{stats.pending}</div>
        </div>
        
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">Approved</span>
          </div>
          <div className="text-2xl font-bold">{stats.approved}</div>
        </div>
        
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium">Rejected</span>
          </div>
          <div className="text-2xl font-bold">{stats.rejected}</div>
        </div>
        
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium">Admins</span>
          </div>
          <div className="text-2xl font-bold">{stats.admins}</div>
        </div>
        
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">Verified</span>
          </div>
          <div className="text-2xl font-bold">{stats.emailVerified}</div>
        </div>
      </div>

      {/* Priority Alert */}
      {stats.pending > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">
              <span className="font-medium">Action Required:</span> You have {stats.pending} pending user{stats.pending !== 1 ? 's' : ''} waiting for approval.
            </p>
          </div>
        </div>
      )}

      {/* Search Results Info */}
      {searchQuery && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredUsers.length} of {usersData.length} users matching "{searchQuery}"
        </div>
      )}

      <UsersTable 
        users={filteredUsers}
        onApprove={handleUserApproval}
        onReject={handleUserRejection}
        onMakeAdmin={handleMakeAdmin}
        onRevokeAdmin={handleRevokeAdmin}
        onDelete={handleDeleteUser}
        isLoading={isLoading || isActionLoading}
      />

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

export default AdminUsers;
