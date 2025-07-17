
import { useState } from "react";
import { User } from "@/types";
import { useToast } from "@/hooks/use-toast";
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
    console.log('🔄 Initiating user approval for:', user.email);
    setSelectedUser(user);
    setActionType("approve");
    setIsDialogOpen(true);
  };
  
  const handleUserRejection = (user: User) => {
    console.log('🔄 Initiating user rejection for:', user.email);
    setSelectedUser(user);
    setActionType("reject");
    setIsDialogOpen(true);
  };
  
  const handleMakeAdmin = (user: User) => {
    console.log('🔄 Initiating admin promotion for:', user.email);
    setSelectedUser(user);
    setActionType("makeAdmin");
    setIsDialogOpen(true);
  };
  
  const handleRevokeAdmin = (user: User) => {
    console.log('🔄 Initiating admin revocation for:', user.email);
    setSelectedUser(user);
    setActionType("revokeAdmin");
    setIsDialogOpen(true);
  };
  
  const confirmAction = async (reason?: string) => {
    if (!selectedUser) {
      console.error('❌ No user selected for action');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No user selected for action.',
      });
      return;
    }
    
    console.log('🔄 Confirming action:', actionType, 'for user:', selectedUser.email);
    
    try {
      switch (actionType) {
        case "approve":
          updateUserStatus(
            { userId: selectedUser.id, status: "approved" },
            {
              onSuccess: async () => {
                try {
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
              onError: (error) => {
                console.error('❌ Error approving user:', error);
                toast({
                  variant: 'destructive',
                  title: 'Approval failed',
                  description: 'Failed to approve user. Please try again.',
                });
              }
            }
          );
          break;
          
        case "reject":
          updateUserStatus(
            { userId: selectedUser.id, status: "rejected" },
            {
              onSuccess: async () => {
                try {
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
              onError: (error) => {
                console.error('❌ Error rejecting user:', error);
                toast({
                  variant: 'destructive',
                  title: 'Rejection failed',
                  description: 'Failed to reject user. Please try again.',
                });
              }
            }
          );
          break;
          
        case "makeAdmin":
          updateAdminStatus(
            { userId: selectedUser.id, isAdmin: true },
            {
              onSuccess: () => {
                console.log('✅ Successfully promoted user to admin');
                setIsDialogOpen(false);
                if (onUserStatusUpdated) onUserStatusUpdated();
              },
              onError: (error) => {
                console.error('❌ Error promoting user to admin:', error);
                toast({
                  variant: 'destructive',
                  title: 'Admin promotion failed',
                  description: 'Failed to promote user to admin. Please try again.',
                });
              }
            }
          );
          break;
          
        case "revokeAdmin":
          updateAdminStatus(
            { userId: selectedUser.id, isAdmin: false },
            {
              onSuccess: () => {
                console.log('✅ Successfully revoked admin privileges');
                setIsDialogOpen(false);
                if (onUserStatusUpdated) onUserStatusUpdated();
              },
              onError: (error) => {
                console.error('❌ Error revoking admin privileges:', error);
                toast({
                  variant: 'destructive',
                  title: 'Admin revocation failed',
                  description: 'Failed to revoke admin privileges. Please try again.',
                });
              }
            }
          );
          break;
          
        default:
          console.error('❌ Unknown action type:', actionType);
          toast({
            variant: 'destructive',
            title: 'Invalid action',
            description: 'Unknown action type. Please try again.',
          });
      }
    } catch (error) {
      console.error("💥 Error during user action:", error);
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: 'An unexpected error occurred. Please try again.',
      });
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
