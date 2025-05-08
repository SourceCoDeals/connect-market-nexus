
import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { UserActions } from "@/components/admin/UserActions";

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
    actionType
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
          Pending: {users.filter((u) => u.approval_status === "pending").length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Approved: {users.filter((u) => u.approval_status === "approved").length}
        </Badge>
        <Badge className="bg-background text-foreground border">
          Admins: {users.filter((u) => u.is_admin).length}
        </Badge>
      </div>

      <UsersTable 
        users={filteredUsers}
        onApprove={handleUserApproval}
        onReject={handleUserRejection}
        onMakeAdmin={handleMakeAdmin}
        onRevokeAdmin={handleRevokeAdmin}
        isLoading={isLoading}
      />

      <UserDetailDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={confirmAction}
        selectedUser={selectedUser}
        actionType={actionType}
        isLoading={false}
      />
    </div>
  );
};

export default AdminUsers;
