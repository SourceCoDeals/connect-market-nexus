import { useState } from "react";
import {
  useAdminUsers,
  useAdminEmail
} from "@/hooks/admin";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { User } from "@/types";
import { UsersTable } from "@/components/admin/UsersTable";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { useToast } from "@/hooks/use-toast";

const AdminUsers = () => {
  const { toast } = useToast();
  const {
    useUsers,
    useUpdateUserStatus,
    useUpdateAdminStatus,
    sendUserApprovalEmail,
    sendUserRejectionEmail
  } = useAdmin();
  
  const { data: users = [], isLoading } = useUsers();
  const { mutate: updateUserStatus } = useUpdateUserStatus();
  const { mutate: updateAdminStatus } = useUpdateAdminStatus();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "makeAdmin" | "revokeAdmin" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.company?.toLowerCase().includes(searchLower)
    );
  });
  
  const handleUserApproval = (user: User) => {
    setSelectedUser(user);
    setActionType("approve");
    setIsDialogOpen(true);
  };
  
  const handleUserRejection = (user: User) => {
    setSelectedUser(user);
    setActionType("reject");
    setIsDialogOpen(true);
  };
  
  const handleMakeAdmin = (user: User) => {
    setSelectedUser(user);
    setActionType("makeAdmin");
    setIsDialogOpen(true);
  };
  
  const handleRevokeAdmin = (user: User) => {
    setSelectedUser(user);
    setActionType("revokeAdmin");
    setIsDialogOpen(true);
  };
  
  const confirmAction = async (reason?: string) => {
    if (!selectedUser) return;
    
    try {
      switch (actionType) {
        case "approve":
          await updateUserStatus(
            { userId: selectedUser.id, status: "approved" },
            {
              onSuccess: async () => {
                try {
                  // Send approval email
                  await sendUserApprovalEmail(selectedUser);
                  toast({
                    title: "User approved",
                    description: `${selectedUser.first_name} ${selectedUser.last_name} has been approved and notified via email.`,
                  });
                } catch (error) {
                  console.error("Error sending approval email:", error);
                  toast({
                    title: "User approved",
                    description: `${selectedUser.first_name} ${selectedUser.last_name} has been approved, but there was an error sending the email notification.`,
                  });
                }
                setIsDialogOpen(false);
              },
            }
          );
          break;
          
        case "reject":
          await updateUserStatus(
            { userId: selectedUser.id, status: "rejected" },
            {
              onSuccess: async () => {
                try {
                  // Send rejection email with reason
                  await sendUserRejectionEmail(selectedUser, reason);
                  toast({
                    title: "User rejected",
                    description: `${selectedUser.first_name} ${selectedUser.last_name} has been rejected and notified via email.`,
                  });
                } catch (error) {
                  console.error("Error sending rejection email:", error);
                  toast({
                    title: "User rejected",
                    description: `${selectedUser.first_name} ${selectedUser.last_name} has been rejected, but there was an error sending the email notification.`,
                  });
                }
                setIsDialogOpen(false);
              },
            }
          );
          break;
          
        case "makeAdmin":
          await updateAdminStatus(
            { userId: selectedUser.id, isAdmin: true },
            {
              onSuccess: () => {
                toast({
                  title: "Admin status granted",
                  description: `${selectedUser.first_name} ${selectedUser.last_name} is now an admin.`,
                });
                setIsDialogOpen(false);
              },
            }
          );
          break;
          
        case "revokeAdmin":
          await updateAdminStatus(
            { userId: selectedUser.id, isAdmin: false },
            {
              onSuccess: () => {
                toast({
                  title: "Admin status revoked",
                  description: `${selectedUser.first_name} ${selectedUser.last_name} is no longer an admin.`,
                });
                setIsDialogOpen(false);
              },
            }
          );
          break;
      }
    } catch (error) {
      console.error("Error during user action:", error);
    }
  };

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
