
import { useState } from "react";
import { User } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminEmail } from "@/hooks/admin/use-admin-email";
import { adminErrorHandler } from "@/lib/error-handler";
import { ApprovalEmailDialog } from "./ApprovalEmailDialog";

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
    sendUserRejectionEmail,
    sendCustomApprovalEmail
  } = useAdminEmail();
  
  // Get actual mutation functions
  const updateUserStatusMutation = useUpdateUserStatus();
  const updateAdminStatusMutation = useUpdateAdminStatus();
  const deleteUserMutation = useDeleteUser();
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "makeAdmin" | "revokeAdmin" | "delete" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isApprovalEmailDialogOpen, setIsApprovalEmailDialogOpen] = useState(false);
  
  const handleUserApproval = (user: User) => {
    setSelectedUser(user);
    setIsApprovalEmailDialogOpen(true);
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
  
  const handleDeleteUser = (user: User) => {
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
    
    
    
    try {
      switch (actionType) {
        case "approve":
          // This case is now handled by the approval email dialog
          break;
          
        case "reject":
          updateUserStatusMutation.mutate(
            { userId: selectedUser.id, status: "rejected" },
            {
              onSuccess: async () => {
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
          updateAdminStatusMutation.mutate(
            { userId: selectedUser.id, isAdmin: true },
            {
              onSuccess: () => {
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
          updateAdminStatusMutation.mutate(
            { userId: selectedUser.id, isAdmin: false },
            {
              onSuccess: () => {
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
          deleteUserMutation.mutate(selectedUser.id, {
            onSuccess: () => {
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

  const handleCustomApprovalEmail = async (user: User, options: {
    subject: string;
    message: string;
    customSignatureHtml?: string;
    customSignatureText?: string;
  }) => {
    try {
      // First update the user status to approved
      await new Promise<void>((resolve, reject) => {
        updateUserStatusMutation.mutate(
          { userId: user.id, status: "approved" },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error)
          }
        );
      });

      // Then send the custom approval email
      await sendCustomApprovalEmail(user, options);
      
      toast({
        title: "User approved",
        description: `${user.first_name} ${user.last_name} has been approved and custom email sent.`,
      });
      
      if (onUserStatusUpdated) onUserStatusUpdated();
    } catch (error) {
      console.error('❌ Error in approval process:', error);
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description: error instanceof Error ? error.message : 'Failed to approve user and send email.',
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
    // Approval email dialog props
    isApprovalEmailDialogOpen,
    setIsApprovalEmailDialogOpen,
    handleCustomApprovalEmail,
    ApprovalEmailDialog: () => (
      <ApprovalEmailDialog
        open={isApprovalEmailDialogOpen}
        onOpenChange={setIsApprovalEmailDialogOpen}
        user={selectedUser}
        onSendApprovalEmail={handleCustomApprovalEmail}
      />
    )
  };
}
