import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminEmail } from "@/hooks/admin/use-admin-email";
import { useAutoCreateFirmOnApproval } from "@/hooks/admin/use-docuseal";
import { ApprovalEmailDialog } from "./ApprovalEmailDialog";

import { UserConfirmationDialog } from "./UserConfirmationDialog";
import { User } from "@/types";
import { ApprovalEmailOptions } from "@/types/admin-users";


interface UserActionsProps {
  onUserStatusUpdated?: () => void;
}

interface DialogState {
  approval: boolean;
  makeAdmin: boolean;
  revokeAdmin: boolean;
  delete: boolean;
}

export function UserActions({ onUserStatusUpdated }: UserActionsProps) {
  const { toast } = useToast();
  
  const {
    useUpdateUserStatus,
    useUpdateAdminStatus,
    useDeleteUser,
  } = useAdminUsers();
  
  const {
    sendCustomApprovalEmail
  } = useAdminEmail();

  const autoCreateFirm = useAutoCreateFirmOnApproval();
  
  // Get actual mutation functions
  const updateUserStatusMutation = useUpdateUserStatus();
  const updateAdminStatusMutation = useUpdateAdminStatus();
  const deleteUserMutation = useDeleteUser();
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Separate dialog states for each action
  const [dialogState, setDialogState] = useState<DialogState>({
    approval: false,
    makeAdmin: false,
    revokeAdmin: false,
    delete: false
  });

  const closeAllDialogs = () => {
    setDialogState({
      approval: false,
      makeAdmin: false,
      revokeAdmin: false,
      delete: false
    });
    setSelectedUser(null);
  };

  const handleUserApproval = (user: User) => {
    setSelectedUser(user);
    setDialogState(prev => ({ ...prev, approval: true }));
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
    // Step 1: Approve user — let this throw so the dialog can show error state
    await updateUserStatusMutation.mutateAsync({ userId: user.id, status: "approved" });

    toast({
      title: "User approved",
      description: `${user.firstName} ${user.lastName} has been approved and can now access the marketplace`,
    });

    // Step 2: Auto-create firm agreement (non-fatal)
    try {
      await autoCreateFirm.mutateAsync({ userId: user.id });
    } catch (firmError) {
      console.error('Auto-create firm failed after approval:', firmError);
    }

    // Step 3: Send email (non-fatal for approval)
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
        description: 'User was approved successfully, but welcome email failed to send.',
      });
    }

    // Close dialogs and refresh after everything succeeds
    closeAllDialogs();
    if (onUserStatusUpdated) onUserStatusUpdated();
  };

  return {
    handleUserApproval,
    handleMakeAdmin,
    handleRevokeAdmin,
    handleDeleteUser,
    handleCustomApprovalEmail,
    confirmMakeAdmin,
    confirmRevokeAdmin,
    confirmDeleteUser,
    dialogState,
    closeAllDialogs,
    selectedUser,
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