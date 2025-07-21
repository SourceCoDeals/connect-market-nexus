import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { User } from "@/types";
import { CheckCircle, XCircle, MoreHorizontal, UserCheck, UserX, UserPlus, UserMinus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { UserSavedListings } from "./UserSavedListings";

interface UsersTableProps {
  users: User[];
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  onMakeAdmin: (user: User) => void;
  onRevokeAdmin: (user: User) => void;
  onDelete: (user: User) => void;
  isLoading: boolean;
}

// Component for user detail view
const UserDetails = ({ user }: { user: User }) => (
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
          {user.email_verified ? " Yes" : " No"}
        </div>
        <div>
          <strong>Account Status:</strong> 
          <span className={`capitalize ml-1 ${
            user.approval_status === "approved" ? "text-green-600" : 
            user.approval_status === "rejected" ? "text-red-600" : 
            "text-yellow-600"
          }`}>
            {user.approval_status}
          </span>
        </div>
        <div>
          <strong>Admin:</strong> {user.is_admin ? " Yes" : " No"}
        </div>
      </div>
    </div>

    {/* Additional buyer information */}
    <div className="mt-2 col-span-1 md:col-span-2 lg:col-span-3">
      <div className="text-sm font-semibold mb-2">Additional Information</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {user.target_company_size && (
          <div className="text-sm">
            <strong>Target Company Size:</strong> {user.target_company_size}
          </div>
        )}
        {user.funding_source && (
          <div className="text-sm">
            <strong>Funding Source:</strong> {user.funding_source}
          </div>
        )}
        {user.investment_size && (
          <div className="text-sm">
            <strong>Investment Size:</strong> {user.investment_size}
          </div>
        )}
        {user.is_funded && (
          <div className="text-sm">
            <strong>Funded:</strong> {user.is_funded}
            {user.funded_by && <span> by {user.funded_by}</span>}
          </div>
        )}
        {user.needs_loan && (
          <div className="text-sm">
            <strong>Needs Loan:</strong> {user.needs_loan}
          </div>
        )}
        {user.ideal_target && (
          <div className="text-sm">
            <strong>Ideal Target:</strong> {user.ideal_target}
          </div>
        )}
        {user.bio && (
          <div className="text-sm col-span-2">
            <strong>Bio:</strong> {user.bio}
          </div>
        )}
      </div>
    </div>

    {/* Saved Listings Section */}
    <div className="mt-4 col-span-1 md:col-span-2 lg:col-span-3">
      <UserSavedListings userId={user.id} />
    </div>
  </div>
);

// Component for user action buttons
function UserActionButtons({ 
  user, 
  onApprove, 
  onReject,
  onMakeAdmin,
  onRevokeAdmin,
  onDelete,
  isLoading 
}: { 
  user: User;
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  onMakeAdmin: (user: User) => void;
  onRevokeAdmin: (user: User) => void;
  onDelete: (user: User) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isLoading}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {user.approval_status === "pending" && (
            <>
              <DropdownMenuItem 
                onClick={() => onApprove(user)}
                className="text-green-600"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Approve User
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onReject(user)}
                className="text-red-600"
              >
                <UserX className="h-4 w-4 mr-2" />
                Reject User
              </DropdownMenuItem>
            </>
          )}
          
          {user.approval_status === "rejected" && (
            <DropdownMenuItem 
              onClick={() => onApprove(user)}
              className="text-green-600"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Approve User
            </DropdownMenuItem>
          )}
          
          {user.approval_status === "approved" && (
            <DropdownMenuItem 
              onClick={() => onReject(user)}
              className="text-red-600"
            >
              <UserX className="h-4 w-4 mr-2" />
              Reject User
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          {!user.is_admin ? (
            <DropdownMenuItem 
              onClick={() => onMakeAdmin(user)}
              className="text-blue-600"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Make Admin
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem 
              onClick={() => onRevokeAdmin(user)}
              className="text-orange-600"
            >
              <UserMinus className="h-4 w-4 mr-2" />
              Revoke Admin
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => onDelete(user)}
            className="text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Loading skeleton component
const UsersTableSkeleton = () => (
  <div className="space-y-3">
    <div className="h-10 bg-muted/50 rounded-md animate-pulse"></div>
    {Array(5)
      .fill(0)
      .map((_, i) => (
        <div key={i} className="h-20 bg-muted/30 rounded-md animate-pulse"></div>
      ))}
  </div>
);

export function UsersTable({ 
  users, 
  onApprove, 
  onReject,
  onMakeAdmin,
  onRevokeAdmin,
  onDelete,
  isLoading 
}: UsersTableProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  
  const toggleExpand = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };
  
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return "Invalid date";
    }
  };

  if (isLoading) {
    return <UsersTableSkeleton />;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">User</TableHead>
            <TableHead className="hidden sm:table-cell">Company</TableHead>
            <TableHead className="hidden md:table-cell">Buyer Type</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-sm">
                No users found.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <React.Fragment key={user.id}>
                <TableRow 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(user.id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {expandedUserId === user.id ? 
                        <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                      <div className="flex flex-col">
                        <span className="text-sm sm:text-base">{user.first_name} {user.last_name}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{user.company || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="capitalize text-xs">
                      {user.buyer_type || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {user.approval_status === "approved" && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                        Approved
                      </Badge>
                    )}
                    {user.approval_status === "pending" && (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">
                        Pending
                      </Badge>
                    )}
                    {user.approval_status === "rejected" && (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
                        Rejected
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">{formatDate(user.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <UserActionButtons 
                      user={user}
                      onApprove={onApprove}
                      onReject={onReject}
                      onMakeAdmin={onMakeAdmin}
                      onRevokeAdmin={onRevokeAdmin}
                      onDelete={onDelete}
                      isLoading={isLoading}
                    />
                  </TableCell>
                </TableRow>
                {expandedUserId === user.id && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-2 px-4 bg-muted/30 border-t">
                      <UserDetails user={user} />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
