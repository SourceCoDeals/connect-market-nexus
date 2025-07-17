
import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, AlertCircle, RefreshCw } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { UserActions } from "@/components/admin/UserActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AdminUsers = () => {
  const { useUsers } = useAdmin();
  const { data: users = [], isLoading, error, refetch } = useUsers();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  
  // Get user action handlers from the component
  const {
    handleUserApproval,
    handleUserRejection,
    handleMakeAdmin,
    handleRevokeAdmin,
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
  };
  
  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.company?.toLowerCase().includes(searchLower)
    );
  });

  const pendingUsers = users.filter((u) => u.approval_status === "pending").length;

  // Error state
  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Error Loading Users</h2>
          <p className="text-muted-foreground text-center mb-6">
            There was an error loading the user data. This might be due to a database connection issue.
          </p>
          <Button onClick={handleRetry} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">User Management</h1>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search users..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <Badge className="bg-background text-foreground border">
          Total: {users.length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Pending: {pendingUsers}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Approved: {users.filter((u) => u.approval_status === "approved").length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Rejected: {users.filter((u) => u.approval_status === "rejected").length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Admins: {users.filter((u) => u.is_admin).length}
        </Badge>
      </div>

      {pendingUsers > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            <span className="font-medium">Attention:</span> You have {pendingUsers} pending user{pendingUsers !== 1 ? 's' : ''} waiting for approval.
          </p>
        </div>
      )}

      <UsersTable 
        users={filteredUsers}
        onApprove={handleUserApproval}
        onReject={handleUserRejection}
        onMakeAdmin={handleMakeAdmin}
        onRevokeAdmin={handleRevokeAdmin}
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
