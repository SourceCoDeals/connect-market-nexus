
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "@/types";
import { Check, X, Shield, ShieldOff, Clock, UserCheck, UserX } from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

interface UserManagementActionsProps {
  user: User;
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  onMakeAdmin: (user: User) => void;
  onRevokeAdmin: (user: User) => void;
  isLoading: boolean;
}

export function UserManagementActions({
  user,
  onApprove,
  onReject,
  onMakeAdmin,
  onRevokeAdmin,
  isLoading
}: UserManagementActionsProps) {
  const getStatusBadge = () => {
    switch (user.approval_status) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <UserCheck className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <UserX className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {user.first_name} {user.last_name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {user.is_admin && (
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            {user.approval_status === "pending" ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => onApprove(user)}
                      disabled={isLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Approve user access to marketplace</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => onReject(user)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reject user application</p>
                  </TooltipContent>
                </Tooltip>
              </>
            ) : user.approval_status === "rejected" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={() => onApprove(user)}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Approve previously rejected user</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onReject(user)}
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Revoke Access
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Revoke user access</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {user.is_admin ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onRevokeAdmin(user)}
                    disabled={isLoading}
                  >
                    <ShieldOff className="h-4 w-4 mr-1" />
                    Remove Admin
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Revoke admin privileges</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onMakeAdmin(user)}
                    disabled={isLoading}
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    Make Admin
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Grant admin privileges</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
        
        {user.company && (
          <div className="mt-3 text-sm text-muted-foreground">
            <strong>Company:</strong> {user.company}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
