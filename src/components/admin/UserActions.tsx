import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAdminUsers } from '@/hooks/admin/use-admin-users';
import { useAdminEmail } from '@/hooks/admin/use-admin-email';
import { useAutoCreateFirmOnApproval } from '@/hooks/admin/use-docuseal';
import { User } from '@/types';
import { ApprovalEmailOptions } from '@/types/admin-users';

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

  const { useUpdateUserStatus, useUpdateAdminStatus, useDeleteUser } = useAdminUsers();

  const { sendCustomApprovalEmail } = useAdminEmail();

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
    delete: false,
  });

  const closeAllDialogs = () => {
    setDialogState({
      approval: false,
      approvalSuccess: false,
      makeAdmin: false,
      revokeAdmin: false,
      delete: false,
    });
    setSelectedUser(null);
  };

  const handleUserApproval = (user: User) => {
    setSelectedUser(user);
    setDialogState((prev) => ({ ...prev, approval: true }));
  };

  const handleMakeAdmin = (user: User) => {
    setSelectedUser(user);
    setDialogState((prev) => ({ ...prev, makeAdmin: true }));
  };

  const handleRevokeAdmin = (user: User) => {
    setSelectedUser(user);
    setDialogState((prev) => ({ ...prev, revokeAdmin: true }));
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setDialogState((prev) => ({ ...prev, delete: true }));
  };

  const confirmMakeAdmin = async () => {
    if (!selectedUser) return;

    updateAdminStatusMutation.mutate(
      { userId: selectedUser.id, isAdmin: true },
      {
        onSuccess: () => {
          toast({
            title: 'Admin privileges granted',
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
        },
      },
    );
  };

  const confirmRevokeAdmin = async () => {
    if (!selectedUser) return;

    updateAdminStatusMutation.mutate(
      { userId: selectedUser.id, isAdmin: false },
      {
        onSuccess: () => {
          toast({
            title: 'Admin privileges revoked',
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
        },
      },
    );
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    deleteUserMutation.mutate(selectedUser.id, {
      onSuccess: () => {
        toast({
          title: 'User deleted',
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
      },
    });
  };

  const handleCustomApprovalEmail = async (user: User, options: ApprovalEmailOptions) => {
    console.log('[UserActions] handleCustomApprovalEmail called for:', user.email, user.id);

    // Step 1: Approve user FIRST
    try {
      console.log('[UserActions] Step 1: Approving user...');
      await updateUserStatusMutation.mutateAsync({ userId: user.id, status: 'approved' });
      console.log('[UserActions] Step 1 SUCCESS: User approved');

      // Store approved user for success dialog
      setApprovedUser(user);

      // Step 2: Auto-create firm agreement
      try {
        console.log('[UserActions] Step 2: Auto-creating firm...');
        await autoCreateFirm.mutateAsync({ userId: user.id });
        console.log('[UserActions] Step 2 SUCCESS');
      } catch (firmError) {
        console.error('[UserActions] Step 2 FAILED (non-fatal):', firmError);
      }

      // Step 3: Send email
      let emailSuccess = false;
      try {
        console.log('[UserActions] Step 3: Sending email...');
        await sendCustomApprovalEmail(user, options);
        emailSuccess = true;
        console.log('[UserActions] Step 3 SUCCESS');
      } catch (emailError) {
        console.error('[UserActions] Step 3 FAILED:', emailError);
      }

      // Show success confirmation dialog — do NOT close dialogs after this,
      // the user will dismiss it by clicking "Done"
      setEmailSent(emailSuccess);
      setDialogState((prev) => ({ ...prev, approvalSuccess: true }));
      console.log('[UserActions] Approval flow complete');

      if (onUserStatusUpdated) onUserStatusUpdated();
    } catch (approvalError) {
      console.error('[UserActions] Step 1 FAILED:', approvalError);
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description:
          approvalError instanceof Error
            ? approvalError.message
            : 'Failed to approve user. Please try again.',
      });
    }
  };

  const handleCloseApprovalSuccess = (open: boolean) => {
    if (!open) {
      setDialogState((prev) => ({ ...prev, approvalSuccess: false }));
      setApprovedUser(null);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) closeAllDialogs();
  };

  const mutationsPending =
    updateUserStatusMutation.isPending ||
    updateAdminStatusMutation.isPending ||
    deleteUserMutation.isPending;

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
    approvedUser,
    emailSent,
    handleCloseDialog,
    handleCloseApprovalSuccess,
    isLoading: mutationsPending,
  };
}
