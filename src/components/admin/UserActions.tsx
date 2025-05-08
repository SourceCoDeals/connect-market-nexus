
import { useState } from "react";
import { User, ApprovalStatus } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { useAdmin } from "@/hooks/use-admin";

interface UserActionsProps {
  onUserStatusUpdated?: () => void;
}

export function UserActions({ onUserStatusUpdated }: UserActionsProps) {
  const { toast } = useToast();
  const {
    useUpdateUserStatus,
    useUpdateAdminStatus,
    sendUserApprovalEmail,
    sendUserRejectionEmail
  } = useAdmin();
  
  const { mutate: updateUserStatus, isPending: isUpdatingStatus } = useUpdateUserStatus();
  const { mutate: updateAdminStatus, isPending: isUpdatingAdmin } = useUpdateAdminStatus();
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "makeAdmin" | "revokeAdmin" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
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
                if (onUserStatusUpdated) onUserStatusUpdated();
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
                if (onUserStatusUpdated) onUserStatusUpdated();
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
                if (onUserStatusUpdated) onUserStatusUpdated();
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
                if (onUserStatusUpdated) onUserStatusUpdated();
              },
            }
          );
          break;
      }
    } catch (error) {
      console.error("Error during user action:", error);
    }
  };

  return {
    handleUserApproval,
    handleUserRejection,
    handleMakeAdmin,
    handleRevokeAdmin,
    confirmAction,
    isDialogOpen,
    setIsDialogOpen,
    selectedUser,
    actionType,
    isLoading: isUpdatingStatus || isUpdatingAdmin
  };
}
