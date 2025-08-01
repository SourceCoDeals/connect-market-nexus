import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminEmail } from "@/hooks/admin/use-admin-email";
import { ApprovalEmailDialog } from "./ApprovalEmailDialog";
import { User } from "@/types";
import { ApprovalEmailOptions } from "@/types/admin-users";

interface UserActionsProps {
  onUserStatusUpdated?: () => void;
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
  const [actionType, setActionType] = useState<"approve" | "reject" | "makeAdmin" | "revokeAdmin" | "delete" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const handleUserApproval = (user: User) => {
    setSelectedUser(user);
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
  
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setActionType("delete");
    setIsDialogOpen(true);
  };
  
  const confirmAction = async (reason?: string) => {
    if (!selectedUser) {
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
          // 1. INSTANT UI UPDATE
          queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
            if (!old) return old;
            return old.map(u => 
              u.id === selectedUser.id 
                ? { ...u, approval_status: "rejected" as const }
                : u
            );
          });

          // 2. INSTANT SUCCESS FEEDBACK
          toast({
            title: "User rejected",
            description: `${selectedUser.firstName} ${selectedUser.lastName} has been rejected instantly`,
          });

          // 3. DATABASE UPDATE IN BACKGROUND
          updateUserStatusMutation.mutate(
            { userId: selectedUser.id, status: "rejected" },
            {
              onSuccess: async () => {
                try {
                  await sendUserRejectionEmail(selectedUser, reason);
                } catch (error) {
                  toast({
                    title: "Email notification delayed",
                    description: "User was rejected but email notification may be delayed.",
                    variant: "default",
                  });
                }
              },
              onError: (error) => {
                // ROLLBACK: Revert the optimistic update
                queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
                  if (!old) return old;
                  return old.map(u => 
                    u.id === selectedUser.id 
                      ? { ...u, approval_status: "pending" as const }
                      : u
                  );
                });
                toast({
                  variant: 'destructive',
                  title: 'Rejection failed',
                  description: error.message || 'Failed to reject user. Please try again.',
                });
              }
            }
          );
          
          setIsDialogOpen(false);
          break;
          
        case "makeAdmin":
          updateAdminStatusMutation.mutate(
            { userId: selectedUser.id, isAdmin: true },
            {
              onSuccess: () => {
                toast({
                  title: "Admin privileges granted",
                  description: `${selectedUser.firstName} ${selectedUser.lastName} is now an admin.`,
                });
                setIsDialogOpen(false);
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
          break;
          
        case "revokeAdmin":
          updateAdminStatusMutation.mutate(
            { userId: selectedUser.id, isAdmin: false },
            {
              onSuccess: () => {
                toast({
                  title: "Admin privileges revoked",
                  description: `${selectedUser.firstName} ${selectedUser.lastName} is no longer an admin.`,
                });
                setIsDialogOpen(false);
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
          break;
          
        case "delete":
          deleteUserMutation.mutate(selectedUser.id, {
            onSuccess: () => {
              toast({
                title: "User deleted",
                description: `${selectedUser.firstName} ${selectedUser.lastName} has been permanently deleted.`,
              });
              setIsDialogOpen(false);
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
          break;
          
        default:
          toast({
            variant: 'destructive',
            title: 'Invalid action',
            description: 'Unknown action type. Please try again.',
          });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    }
  };

  const handleCustomApprovalEmail = async (user: User, options: ApprovalEmailOptions) => {
    try {
      // 1. INSTANT UI UPDATE
      queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
        if (!old) return old;
        return old.map(u => 
          u.id === user.id 
            ? { ...u, approval_status: "approved" as const }
            : u
        );
      });

      // 2. INSTANT SUCCESS FEEDBACK
      toast({
        title: "User approved instantly",
        description: `${user.firstName} ${user.lastName} has been approved and can now access the marketplace`,
      });

      // 3. DATABASE UPDATE IN BACKGROUND
      updateUserStatusMutation.mutate(
        { userId: user.id, status: "approved" },
        {
          onError: (error) => {
            // ROLLBACK: Revert the optimistic update
            queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
              if (!old) return old;
              return old.map(u => 
                u.id === user.id 
                  ? { ...u, approval_status: "pending" as const }
                  : u
              );
            });
            toast({
              variant: 'destructive',
              title: 'Approval failed',
              description: error.message || 'Failed to approve user. Please try again.',
            });
          }
        }
      );

      // 4. EMAIL SENDING IN BACKGROUND
      sendCustomApprovalEmail(user, options).catch(() => {
        toast({
          variant: 'destructive',
          title: 'Email sending failed',
          description: 'User was approved but email may not have been sent.',
        });
      });
      
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description: 'An unexpected error occurred during approval.',
      });
    }
  };

  return {
    handleUserApproval,
    handleUserRejection,
    handleMakeAdmin,
    handleRevokeAdmin,
    handleDeleteUser,
    handleCustomApprovalEmail,
    confirmAction,
    isDialogOpen,
    setIsDialogOpen,
    selectedUser,
    actionType,
    isLoading: updateUserStatusMutation.isPending || updateAdminStatusMutation.isPending || deleteUserMutation.isPending,
    ApprovalEmailDialog: () => (
      <ApprovalEmailDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        user={selectedUser}
        onSendApprovalEmail={handleCustomApprovalEmail}
      />
    ),
  };
}