
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User } from "@/types";
import { Check, Shield, ShieldOff, X } from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

interface UsersTableProps {
  users: User[];
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  onMakeAdmin: (user: User) => void;
  onRevokeAdmin: (user: User) => void;
  isLoading: boolean;
}

export function UsersTable({ 
  users, 
  onApprove, 
  onReject,
  onMakeAdmin,
  onRevokeAdmin,
  isLoading 
}: UsersTableProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  
  const toggleExpand = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">User</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Buyer Type</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No users found.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <>
                <TableRow 
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(user.id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{user.first_name} {user.last_name}</span>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.company || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {user.buyer_type || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {user.approval_status === "approved" && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Approved
                      </Badge>
                    )}
                    {user.approval_status === "pending" && (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                        Pending
                      </Badge>
                    )}
                    {user.approval_status === "rejected" && (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                        Rejected
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.is_admin ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        Admin
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                        {user.approval_status === "pending" && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  onClick={() => onApprove(user)}
                                  disabled={isLoading}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Approve User</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  onClick={() => onReject(user)}
                                  disabled={isLoading}
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reject User</p>
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                        
                        {user.is_admin ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => onRevokeAdmin(user)}
                                disabled={isLoading}
                              >
                                <ShieldOff className="h-4 w-4 text-blue-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Revoke Admin Status</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => onMakeAdmin(user)}
                                disabled={isLoading}
                              >
                                <Shield className="h-4 w-4 text-blue-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Make Admin</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
                {expandedUserId === user.id && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-2 px-4 bg-muted/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm font-semibold">Contact Information</div>
                          <div className="text-sm mt-1">
                            <div><strong>Email:</strong> {user.email}</div>
                            <div><strong>Phone:</strong> {user.phone_number || "—"}</div>
                            <div><strong>Website:</strong> {user.website || "—"}</div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-semibold">Business Information</div>
                          <div className="text-sm mt-1">
                            <div><strong>Company:</strong> {user.company || "—"}</div>
                            <div><strong>Buyer Type:</strong> {user.buyer_type || "—"}</div>
                            {user.buyer_type === "corporate" && (
                              <div><strong>Est. Revenue:</strong> {user.estimated_revenue || "—"}</div>
                            )}
                            {(user.buyer_type === "privateEquity" || user.buyer_type === "familyOffice") && (
                              <div><strong>Fund Size:</strong> {user.fund_size || "—"}</div>
                            )}
                            {user.buyer_type === "familyOffice" && (
                              <div><strong>AUM:</strong> {user.aum || "—"}</div>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-semibold">Account Information</div>
                          <div className="text-sm mt-1">
                            <div><strong>Created:</strong> {new Date(user.created_at).toLocaleString()}</div>
                            <div>
                              <strong>Email Verified:</strong> 
                              {user.email_verified ? "Yes" : "No"}
                            </div>
                            <div>
                              <strong>Account Status:</strong> 
                              <span className={`capitalize ${
                                user.approval_status === "approved" ? "text-green-600" : 
                                user.approval_status === "rejected" ? "text-red-600" : 
                                "text-yellow-600"
                              }`}>
                                {user.approval_status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
