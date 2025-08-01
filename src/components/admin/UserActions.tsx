
import { useState } from "react";
import { User } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminEmail } from "@/hooks/admin/use-admin-email";
import { adminErrorHandler } from "@/lib/error-handler";
import { ApprovalEmailDialog } from "./ApprovalEmailDialog";
import { useQueryClient } from "@tanstack/react-query";

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
          // 1. INSTANT UI UPDATE - Same pattern as approval
          queryClient.setQueryData(['admin-users'], (old: any[] | undefined) => {
            if (!old) return old;
            console.log('🚀 OPTIMISTIC UPDATE: Rejecting user', selectedUser.id);
            const updated = old.map(u => 
              u.id === selectedUser.id 
                ? { ...u, approval_status: "rejected" }
                : u
            );
            console.log('✅ Cache updated successfully');
            return updated;
          });

          // 2. INSTANT SUCCESS FEEDBACK
          toast({
            title: "User rejected",
            description: `${selectedUser.first_name} ${selectedUser.last_name} has been rejected instantly`,
          });

          // 3. DATABASE UPDATE IN BACKGROUND
          updateUserStatusMutation.mutate(
            { userId: selectedUser.id, status: "rejected" },
            {
              onSuccess: async () => {
                try {
                  await sendUserRejectionEmail(selectedUser, reason);
                  console.log('✅ Rejection email sent successfully');
                } catch (error) {
                  console.error("❌ Error sending rejection email:", error);
                  toast({
                    title: "Email notification delayed",
                    description: "User was rejected but email notification may be delayed.",
                    variant: "default",
                  });
                }
              },
              onError: (error) => {
                console.error('❌ Error rejecting user in database:', error);
                // ROLLBACK: Revert the optimistic update
                queryClient.setQueryData(['admin-users'], (old: any[] | undefined) => {
                  if (!old) return old;
                  return old.map(u => 
                    u.id === selectedUser.id 
                      ? { ...u, approval_status: "pending" } // Revert to original status
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
      // 1. INSTANT UI UPDATE - Force immediate cache update with proper typing
      queryClient.setQueryData(['admin-users'], (old: any[] | undefined) => {
        if (!old) return old;
        console.log('🚀 OPTIMISTIC UPDATE: Updating user', user.id, 'to approved');
        const updated = old.map(u => 
          u.id === user.id 
            ? { ...u, approval_status: "approved" }
            : u
        );
        console.log('✅ Cache updated successfully');
        return updated;
      });

      // 2. INSTANT SUCCESS FEEDBACK
      toast({
        title: "✅ User approved instantly",
        description: `${user.first_name} ${user.last_name} has been approved and can now access the marketplace`,
      });

      // 3. DATABASE UPDATE IN BACKGROUND - Don't await, let it run async
      updateUserStatusMutation.mutate(
        { userId: user.id, status: "approved" },
        {
          onError: (error) => {
            console.error('❌ Error approving user in database:', error);
            // ROLLBACK: Revert the optimistic update
            queryClient.setQueryData(['admin-users'], (old: any[] | undefined) => {
              if (!old) return old;
              return old.map(u => 
                u.id === user.id 
                  ? { ...u, approval_status: "pending" } // Revert to original status
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

      // 4. EMAIL SENDING IN BACKGROUND - Don't await, let it run async
      sendCustomApprovalEmail(user, options).catch((error) => {
        console.error('❌ Error sending approval email:', error);
        toast({
          variant: 'destructive',
          title: 'Email sending failed',
          description: 'User was approved but email may not have been sent.',
        });
      });
      
    } catch (error) {
      console.error('❌ Error in approval process:', error);
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description: error instanceof Error ? error.message : 'Failed to approve user.',
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
