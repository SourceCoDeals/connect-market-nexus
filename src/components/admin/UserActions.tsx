
import { useState } from "react";
import { User } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminEmail } from "@/hooks/admin/use-admin-email";
import { adminErrorHandler } from "@/lib/error-handler";

interface UserActionsProps {
  onUserStatusUpdated?: () => void;
}

export function UserActions({ onUserStatusUpdated }: UserActionsProps) {
  const { toast } = useToast();
  const {
    useUpdateUserStatus,
    useUpdateAdminStatus,
    useDeleteUser,
  } = useAdminUsers();
  
  const {
    sendUserApprovalEmail,
    sendUserRejectionEmail
  } = useAdminEmail();
  
  // Get actual mutation functions
  const updateUserStatusMutation = useUpdateUserStatus();
  const updateAdminStatusMutation = useUpdateAdminStatus();
  const deleteUserMutation = useDeleteUser();
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "makeAdmin" | "revokeAdmin" | "delete" | null>(null);
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
  
  const handleDeleteUser = (user: User) => {
    console.log('🔄 Initiating user deletion for:', user.email);
    setSelectedUser(user);
    setActionType("delete");
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
          console.log('🔄 Executing user approval mutation');
          updateUserStatusMutation.mutate(
            { userId: selectedUser.id, status: "approved" },
            {
              onSuccess: async () => {
                console.log('✅ User approval successful, sending email notification');
                try {
                  await sendUserApprovalEmail(selectedUser);
                  toast({
                    title: "User approved",
                    description: `${selectedUser.first_name} ${selectedUser.last_name} has been approved and will receive an email notification with login instructions.`,
                  });
                } catch (error) {
                  console.error("❌ Error sending approval email:", error);
                  toast({
                    title: "User approved",
                    description: `${selectedUser.first_name} ${selectedUser.last_name} has been approved. Email notification may be delayed.`,
                    variant: "default",
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
                  description: error.message || 'Failed to approve user. Please try again.',
                });
              }
            }
          );
          break;
          
        case "reject":
          console.log('🔄 Executing user rejection mutation');
          updateUserStatusMutation.mutate(
            { userId: selectedUser.id, status: "rejected" },
            {
              onSuccess: async () => {
                console.log('✅ User rejection successful, sending email notification');
                try {
                  await sendUserRejectionEmail(selectedUser, reason);
                  toast({
                    title: "User rejected",
                    description: `${selectedUser.first_name} ${selectedUser.last_name} has been rejected and will receive an email notification.`,
                  });
                } catch (error) {
                  console.error("❌ Error sending rejection email:", error);
                  toast({
                    title: "User rejected",
                    description: `${selectedUser.first_name} ${selectedUser.last_name} has been rejected. Email notification may be delayed.`,
                    variant: "default",
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
                  description: error.message || 'Failed to reject user. Please try again.',
                });
              }
            }
          );
          break;
          
        case "makeAdmin":
          console.log('🔄 Executing admin promotion mutation');
          updateAdminStatusMutation.mutate(
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
                  description: error.message || 'Failed to promote user to admin. Please try again.',
                });
              }
            }
          );
          break;
          
        case "revokeAdmin":
          console.log('🔄 Executing admin revocation mutation');
          updateAdminStatusMutation.mutate(
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
                  description: error.message || 'Failed to revoke admin privileges. Please try again.',
                });
              }
            }
          );
          break;
          
        case "delete":
          console.log('🔄 Executing user deletion mutation');
          deleteUserMutation.mutate(selectedUser.id, {
            onSuccess: () => {
              console.log('✅ Successfully deleted user completely');
              toast({
                title: "User deleted",
                description: `${selectedUser.first_name} ${selectedUser.last_name} has been completely removed from the system and can no longer log in.`,
              });
              setIsDialogOpen(false);
              if (onUserStatusUpdated) onUserStatusUpdated();
            },
            onError: (error) => {
              console.error('❌ Error deleting user:', error);
              toast({
                variant: 'destructive',
                title: 'Deletion failed',
                description: error.message || 'Failed to delete user. Please try again.',
              });
            }
          });
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
    handleDeleteUser,
    confirmAction,
    isDialogOpen,
    setIsDialogOpen,
    selectedUser,
    actionType,
    isLoading: updateUserStatusMutation.isPending || updateAdminStatusMutation.isPending || deleteUserMutation.isPending,
    retryStates: {
      updateStatus: (updateUserStatusMutation as any).meta?.retryState,
      updateAdmin: (updateAdminStatusMutation as any).meta?.retryState,
      deleteUser: (deleteUserMutation as any).meta?.retryState,
    },
  };
}
