import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX, 
  Mail, 
  FileText,
  MoreHorizontal,
  Shield,
  ShieldOff
} from "lucide-react";
import { useLongPress, triggerHaptic } from "@/hooks/use-mobile-gestures";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface TouchOptimizedActionsProps {
  actions: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant?: "default" | "secondary" | "outline" | "destructive";
    onClick: () => void;
    priority?: "high" | "medium" | "low";
    confirmMessage?: string;
  }>;
  className?: string;
  maxVisible?: number;
}

export function TouchOptimizedActions({
  actions,
  className,
  maxVisible = 2
}: TouchOptimizedActionsProps) {
  const isMobile = useIsMobile();
  
  if (!isMobile) {
    // Desktop: show all actions as buttons
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        {actions.map((action) => {
          const IconComponent = action.icon;
          return (
            <Button
              key={action.id}
              variant={action.variant || "outline"}
              size="sm"
              onClick={() => {
                if (action.confirmMessage) {
                  if (window.confirm(action.confirmMessage)) {
                    action.onClick();
                  }
                } else {
                  action.onClick();
                }
              }}
            >
              <IconComponent className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          );
        })}
      </div>
    );
  }

  // Mobile: show primary actions + overflow menu
  const primaryActions = actions
    .filter(a => a.priority === "high")
    .slice(0, maxVisible);
  
  const secondaryActions = actions.filter(a => a.priority !== "high");
  const overflowActions = [
    ...actions.filter(a => a.priority === "high").slice(maxVisible),
    ...secondaryActions
  ];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Primary actions - always visible */}
      {primaryActions.map((action) => (
        <TouchOptimizedButton key={action.id} action={action} />
      ))}
      
      {/* Overflow menu for secondary actions */}
      {overflowActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 touch-manipulation"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {overflowActions.map((action, index) => {
              const IconComponent = action.icon;
              const isDestructive = action.variant === "destructive";
              
              return (
                <React.Fragment key={action.id}>
                  {index > 0 && secondaryActions.includes(action) && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      triggerHaptic({ type: 'light' });
                      if (action.confirmMessage) {
                        if (window.confirm(action.confirmMessage)) {
                          action.onClick();
                        }
                      } else {
                        action.onClick();
                      }
                    }}
                    className={cn(
                      "min-h-[44px] cursor-pointer",
                      isDestructive && "text-destructive focus:text-destructive"
                    )}
                  >
                    <IconComponent className="h-4 w-4 mr-3" />
                    {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function TouchOptimizedButton({ action }: { action: any }) {
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      triggerHaptic({ type: 'medium' });
      if (action.confirmMessage) {
        if (window.confirm(action.confirmMessage)) {
          action.onClick();
        }
      } else {
        action.onClick();
      }
    },
    threshold: 600,
  });

  const IconComponent = action.icon;

  return (
    <Button
      variant={action.variant || "outline"}
      size="sm"
      className={cn(
        "h-10 touch-manipulation active:scale-95 transition-transform",
        "min-h-[44px] min-w-[44px]" // Ensure minimum touch target
      )}
      onClick={() => {
        triggerHaptic({ type: 'light' });
        if (action.confirmMessage) {
          if (window.confirm(action.confirmMessage)) {
            action.onClick();
          }
        } else {
          action.onClick();
        }
      }}
      {...longPressHandlers}
    >
      <IconComponent className="h-4 w-4" />
      <span className="sr-only">{action.label}</span>
    </Button>
  );
}

// Preset action configurations for common admin actions
export const adminUserActions = {
  approve: (onApprove: () => void) => ({
    id: 'approve',
    label: 'Approve User',
    icon: UserCheck,
    variant: 'default' as const,
    priority: 'high' as const,
    onClick: onApprove,
  }),
  reject: (onReject: () => void) => ({
    id: 'reject',
    label: 'Reject User',
    icon: UserX,
    variant: 'destructive' as const,
    priority: 'medium' as const,
    onClick: onReject,
    confirmMessage: 'Are you sure you want to reject this user?',
  }),
  makeAdmin: (onMakeAdmin: () => void) => ({
    id: 'make-admin',
    label: 'Make Admin',
    icon: Shield,
    variant: 'secondary' as const,
    priority: 'low' as const,
    onClick: onMakeAdmin,
    confirmMessage: 'Grant admin privileges to this user?',
  }),
  revokeAdmin: (onRevokeAdmin: () => void) => ({
    id: 'revoke-admin',
    label: 'Revoke Admin',
    icon: ShieldOff,
    variant: 'destructive' as const,
    priority: 'low' as const,
    onClick: onRevokeAdmin,
    confirmMessage: 'Remove admin privileges from this user?',
  }),
  sendEmail: (onSendEmail: () => void) => ({
    id: 'send-email',
    label: 'Send Email',
    icon: Mail,
    variant: 'outline' as const,
    priority: 'medium' as const,
    onClick: onSendEmail,
  }),
  sendNDA: (onSendNDA: () => void) => ({
    id: 'send-nda',
    label: 'Send NDA',
    icon: FileText,
    variant: 'outline' as const,
    priority: 'medium' as const,
    onClick: onSendNDA,
  }),
  delete: (onDelete: () => void) => ({
    id: 'delete',
    label: 'Delete User',
    icon: Trash2,
    variant: 'destructive' as const,
    priority: 'low' as const,
    onClick: onDelete,
    confirmMessage: 'Are you sure you want to delete this user? This action cannot be undone.',
  }),
};