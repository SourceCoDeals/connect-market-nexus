
import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { QuickStats } from "@/components/admin/QuickStats";
import { UserManagementActions } from "@/components/admin/UserManagementActions";
import { UserActions } from "@/components/admin/UserActions";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const AdminUsers = () => {
  const { useUsers } = useAdmin();
  const { data: users = [], isLoading, refetch } = useUsers();
  
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
  const approvedUsers = users.filter((u) => u.approval_status === "approved").length;
  const rejectedUsers = users.filter((u) => u.approval_status === "rejected").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading users..." />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage user registrations and permissions
          </p>
        </div>
        <div className="relative w-full md:w-72 mt-4 md:mt-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search users..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <QuickStats
        totalUsers={users.length}
        approvedUsers={approvedUsers}
        pendingUsers={pendingUsers}
        rejectedUsers={rejectedUsers}
      />

      {pendingUsers > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            <span className="font-medium">Action Required:</span> You have {pendingUsers} user{pendingUsers !== 1 ? 's' : ''} waiting for approval.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredUsers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No users found matching your search.</p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <UserManagementActions
              key={user.id}
              user={user}
              onApprove={handleUserApproval}
              onReject={handleUserRejection}
              onMakeAdmin={handleMakeAdmin}
              onRevokeAdmin={handleRevokeAdmin}
              isLoading={isActionLoading}
            />
          ))
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

export default AdminUsers;
