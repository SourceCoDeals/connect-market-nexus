import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminEmail } from "@/hooks/admin/use-admin-email";
import { ApprovalEmailDialog } from "./ApprovalEmailDialog";
import { UserRejectionDialog } from "./UserRejectionDialog";
import { UserConfirmationDialog } from "./UserConfirmationDialog";
import { User } from "@/types";
import { ApprovalEmailOptions } from "@/types/admin-users";


interface UserActionsProps {
  onUserStatusUpdated?: () => void;
}

interface DialogState {
  approval: boolean;
  rejection: boolean;
  makeAdmin: boolean;
  revokeAdmin: boolean;
  delete: boolean;
}

export function UserActions({ onUserStatusUpdated }: UserActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const {
    useUpdateUserStatus,
    useUpdateAdminStatus,
    useDeleteUser,
  } = useAdminUsers();
  
  const {
    sendUserRejectionEmail,
    sendCustomApprovalEmail
  } = useAdminEmail();
  
  // Get actual mutation functions
  const updateUserStatusMutation = useUpdateUserStatus();
  const updateAdminStatusMutation = useUpdateAdminStatus();
  const deleteUserMutation = useDeleteUser();
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  
  // Separate dialog states for each action
  const [dialogState, setDialogState] = useState<DialogState>({
    approval: false,
    rejection: false,
    makeAdmin: false,
    revokeAdmin: false,
    delete: false
  });

  const closeAllDialogs = () => {
    setDialogState({
      approval: false,
      rejection: false,
      makeAdmin: false,
      revokeAdmin: false,
      delete: false
    });
    setSelectedUser(null);
    setRejectionReason("");
  };

  const handleUserApproval = (user: User) => {
    setSelectedUser(user);
    setDialogState(prev => ({ ...prev, approval: true }));
  };
  
  const handleUserRejection = (user: User) => {
    setSelectedUser(user);
    setDialogState(prev => ({ ...prev, rejection: true }));
  };
  
  const handleMakeAdmin = (user: User) => {
    setSelectedUser(user);
    setDialogState(prev => ({ ...prev, makeAdmin: true }));
  };
  
  const handleRevokeAdmin = (user: User) => {
    setSelectedUser(user);
    setDialogState(prev => ({ ...prev, revokeAdmin: true }));
  };
  
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setDialogState(prev => ({ ...prev, delete: true }));
  };

  const confirmUserRejection = async () => {
    if (!selectedUser) return;
    
    // Close dialog immediately 
    closeAllDialogs();
    
    updateUserStatusMutation.mutate(
      { userId: selectedUser.id, status: "rejected" },
      {
        onSuccess: async () => {
          toast({
            title: "User rejected",
            description: `${selectedUser.firstName} ${selectedUser.lastName} has been rejected`,
          });
          
          try {
            await sendUserRejectionEmail(selectedUser, rejectionReason);
          } catch (error) {
            toast({
              title: "Email notification delayed",
              description: "User was rejected but email notification may be delayed.",
              variant: "default",
            });
          }
          
          if (onUserStatusUpdated) onUserStatusUpdated();
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Rejection failed',
            description: error.message || 'Failed to reject user. Please try again.',
          });
        }
      }
    );
  };

  const confirmMakeAdmin = async () => {
    if (!selectedUser) return;

    updateAdminStatusMutation.mutate(
      { userId: selectedUser.id, isAdmin: true },
      {
        onSuccess: () => {
          toast({
            title: "Admin privileges granted",
            description: `${selectedUser.firstName} ${selectedUser.lastName} is now an admin.`,
          });
          closeAllDialogs();
          if (onUserStatusUpdated) onUserStatusUpdated();
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Admin promotion failed',
            description: error.message || 'Failed to promote user to admin. Please try again.',
          });
        }
      }
    );
  };

  const confirmRevokeAdmin = async () => {
    if (!selectedUser) return;

    updateAdminStatusMutation.mutate(
      { userId: selectedUser.id, isAdmin: false },
      {
        onSuccess: () => {
          toast({
            title: "Admin privileges revoked",
            description: `${selectedUser.firstName} ${selectedUser.lastName} is no longer an admin.`,
          });
          closeAllDialogs();
          if (onUserStatusUpdated) onUserStatusUpdated();
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Admin revocation failed',
            description: error.message || 'Failed to revoke admin privileges. Please try again.',
          });
        }
      }
    );
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    deleteUserMutation.mutate(selectedUser.id, {
      onSuccess: () => {
        toast({
          title: "User deleted",
          description: `${selectedUser.firstName} ${selectedUser.lastName} has been permanently deleted.`,
        });
        closeAllDialogs();
        if (onUserStatusUpdated) onUserStatusUpdated();
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Deletion failed',
          description: error.message || 'Failed to delete user. Please try again.',
        });
      }
    });
  };

  const handleCustomApprovalEmail = async (user: User, options: ApprovalEmailOptions) => {
    // Close dialog immediately 
    closeAllDialogs();
    
    updateUserStatusMutation.mutate(
      { userId: user.id, status: "approved" },
      {
        onSuccess: async () => {
          toast({
            title: "User approved",
            description: `${user.firstName} ${user.lastName} has been approved and can now access the marketplace`,
          });
          
          try {
            await sendCustomApprovalEmail(user, options);
            toast({
              title: "Email sent successfully",
              description: `Welcome email delivered to ${user.email}`,
            });
          } catch (emailError) {
            toast({
              variant: 'default',
              title: 'Email sending failed',
              description: 'User was approved but email may not have been sent.',
            });
          }
          
          if (onUserStatusUpdated) onUserStatusUpdated();
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Approval failed',
            description: error.message || 'Failed to approve user. Please try again.',
          });
        }
      }
    );
  };

  return {
    handleUserApproval,
    handleUserRejection,
    handleMakeAdmin,
    handleRevokeAdmin,
    handleDeleteUser,
    handleCustomApprovalEmail,
    confirmUserRejection,
    confirmMakeAdmin,
    confirmRevokeAdmin,
    confirmDeleteUser,
    dialogState,
    closeAllDialogs,
    selectedUser,
    rejectionReason,
    setRejectionReason,
    isLoading: updateUserStatusMutation.isPending || updateAdminStatusMutation.isPending || deleteUserMutation.isPending,
    ApprovalEmailDialog: () => (
      <ApprovalEmailDialog
        open={dialogState.approval}
        onOpenChange={(open) => {
          if (!open) closeAllDialogs();
        }}
        user={selectedUser}
        onSendApprovalEmail={handleCustomApprovalEmail}
      />
    ),
    RejectionDialog: () => (
      <UserRejectionDialog
        open={dialogState.rejection}
        onOpenChange={(open) => {
          if (!open) closeAllDialogs();
        }}
        user={selectedUser}
        reason={rejectionReason}
        onReasonChange={setRejectionReason}
        onConfirm={confirmUserRejection}
        isLoading={updateUserStatusMutation.isPending || updateAdminStatusMutation.isPending || deleteUserMutation.isPending}
      />
    ),
    AdminDialog: () => (
      <UserConfirmationDialog
        open={dialogState.makeAdmin}
        onOpenChange={(open) => {
          if (!open) closeAllDialogs();
        }}
        user={selectedUser}
        title="Grant Admin Privileges"
        description="Are you sure you want to grant admin privileges to {userName}?"
        confirmText="Grant Admin Access"
        onConfirm={confirmMakeAdmin}
        isLoading={updateUserStatusMutation.isPending || updateAdminStatusMutation.isPending || deleteUserMutation.isPending}
      />
    ),
    RevokeAdminDialog: () => (
      <UserConfirmationDialog
        open={dialogState.revokeAdmin}
        onOpenChange={(open) => {
          if (!open) closeAllDialogs();
        }}
        user={selectedUser}
        title="Revoke Admin Privileges"
        description="Are you sure you want to revoke admin privileges from {userName}?"
        confirmText="Revoke Admin Access"
        confirmVariant="destructive"
        onConfirm={confirmRevokeAdmin}
        isLoading={updateUserStatusMutation.isPending || updateAdminStatusMutation.isPending || deleteUserMutation.isPending}
      />
    ),
    DeleteDialog: () => (
      <UserConfirmationDialog
        open={dialogState.delete}
        onOpenChange={(open) => {
          if (!open) closeAllDialogs();
        }}
        user={selectedUser}
        title="Delete User"
        description="Are you sure you want to permanently delete {userName}? This action cannot be undone."
        confirmText="Delete User"
        confirmVariant="destructive"
        onConfirm={confirmDeleteUser}
        isLoading={updateUserStatusMutation.isPending || updateAdminStatusMutation.isPending || deleteUserMutation.isPending}
      />
    ),
  };
}