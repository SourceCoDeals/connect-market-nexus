import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAdminUsers } from '@/hooks/admin/use-admin-users';
import { useAdminEmail } from '@/hooks/admin/use-admin-email';
import { supabase } from '@/integrations/supabase/client';
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
    console.log('[UserActions] handleUserApproval called for:', user.email);
    setSelectedUser(user);
    // Use setTimeout to avoid Radix DropdownMenu/Dialog portal race condition
    // The dropdown's cleanup can interfere with the dialog opening if they happen simultaneously
    setTimeout(() => {
      console.log('[UserActions] Opening approval dialog (deferred)');
      setDialogState((prev) => ({ ...prev, approval: true }));
    }, 50);
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
            description: `${selectedUser.first_name} ${selectedUser.last_name} is now an admin.`,
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
            description: `${selectedUser.first_name} ${selectedUser.last_name} is no longer an admin.`,
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
          description: `${selectedUser.first_name} ${selectedUser.last_name} has been permanently deleted.`,
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

      // Step 2: Calculate Buyer Quality Score (fire-and-forget, non-blocking)
      supabase.functions
        .invoke('calculate-buyer-quality-score', { body: { profile_id: user.id } })
        .then((res) => {
          if (res.error) console.error('[UserActions] Quality score calc failed:', res.error);
          else console.log('[UserActions] Quality score calculated:', res.data?.total_score);
        })
        .catch((err) => console.error('[UserActions] Quality score calc error:', err));

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

      // Close approval dialog and show success dialog
      setEmailSent(emailSuccess);
      setDialogState((prev) => ({ ...prev, approval: false, approvalSuccess: true }));
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
