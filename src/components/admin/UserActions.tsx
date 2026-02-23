import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminEmail } from "@/hooks/admin/use-admin-email";
import { useAutoCreateFirmOnApproval } from "@/hooks/admin/use-docuseal";
import { ApprovalEmailDialog } from "./ApprovalEmailDialog";
import { ApprovalSuccessDialog } from "./ApprovalSuccessDialog";
import { UserConfirmationDialog } from "./UserConfirmationDialog";
import { User } from "@/types";
import { ApprovalEmailOptions } from "@/types/admin-users";


interface UserActionsProps {
  onUserStatusUpdated?: () => void;
}

interface DialogState {
  approval: boolean;
  approvalSuccess: boolean;
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
  const [approvedUser, setApprovedUser] = useState<User | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  
  // Separate dialog states for each action
  const [dialogState, setDialogState] = useState<DialogState>({
    approval: false,
    approvalSuccess: false,
    makeAdmin: false,
    revokeAdmin: false,
    delete: false
  });

  const closeAllDialogs = () => {
    setDialogState({
      approval: false,
      approvalSuccess: false,
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
    // Close dialog immediately 
    closeAllDialogs();
    
    // Step 1: Approve user FIRST - this happens immediately and independently
    try {
      await updateUserStatusMutation.mutateAsync({ userId: user.id, status: "approved" });

      // Store approved user for success dialog
      setApprovedUser(user);

      // Step 2: Auto-create firm agreement and prepare NDA signing
      try {
        await autoCreateFirm.mutateAsync({ userId: user.id });
      } catch (firmError) {
        console.error('Auto-create firm failed after approval:', firmError);
        // Non-fatal - admin can manually create firm later
      }

      // Step 3: Send email as a separate, non-blocking operation
      let emailSuccess = false;
      try {
        await sendCustomApprovalEmail(user, options);
        emailSuccess = true;
      } catch (emailError) {
        // Email failed but approval succeeded
      }

      // Show success confirmation dialog
      setEmailSent(emailSuccess);
      setDialogState(prev => ({ ...prev, approvalSuccess: true }));

      if (onUserStatusUpdated) onUserStatusUpdated();
      
    } catch (approvalError) {
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description: (approvalError instanceof Error ? approvalError.message : undefined) || 'Failed to approve user. Please try again.',
      });
    }
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
      <>
        <ApprovalEmailDialog
          open={dialogState.approval}
          onOpenChange={(open) => {
            if (!open) closeAllDialogs();
          }}
          user={selectedUser}
          onSendApprovalEmail={handleCustomApprovalEmail}
        />
        <ApprovalSuccessDialog
          open={dialogState.approvalSuccess}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setDialogState(prev => ({ ...prev, approvalSuccess: false }));
              setApprovedUser(null);
            }
          }}
          user={approvedUser}
          emailSent={emailSent}
        />
      </>
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