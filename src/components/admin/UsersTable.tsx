import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { User } from "@/types";
import { CheckCircle, XCircle, MoreHorizontal, UserCheck, UserX, UserPlus, UserMinus, Trash2, ChevronDown, ChevronRight, ExternalLink, Mail, Building, UserIcon, Linkedin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { UserSavedListings } from "./UserSavedListings";
import { UserDataCompleteness } from "./UserDataCompleteness";
import { getFieldCategories, FIELD_LABELS } from '@/lib/buyer-type-fields';

interface UsersTableProps {
  users: User[];
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  onMakeAdmin: (user: User) => void;
  onRevokeAdmin: (user: User) => void;
  onDelete: (user: User) => void;
  isLoading: boolean;
}

// Helper function to render user detail with proper field filtering
const UserDetails = ({ user }: { user: User }) => {
  // Get buyer-type specific field categories
  const fieldCategories = getFieldCategories(user.buyer_type || 'corporate');

  return (
    <div className="space-y-6 p-4 bg-muted/20 rounded-lg">
      {/* Account Information Section */}
      <div className="space-y-3">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <UserIcon className="h-4 w-4" />
          Account Information
        </h4>
        <div className="pl-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Created:</span> {new Date(user.created_at).toLocaleString()}</div>
          <div>
            <span className="text-muted-foreground">Email Verified:</span> 
            {user.email_verified ? " Yes" : " No"}
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span> 
            <span className={`capitalize ml-1 ${
              user.approval_status === "approved" ? "text-green-600" : 
              user.approval_status === "rejected" ? "text-red-600" : 
              "text-yellow-600"
            }`}>
              {user.approval_status}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Admin:</span> {user.is_admin ? " Yes" : " No"}
          </div>
        </div>
      </div>

      {/* Render each field category dynamically */}
      {Object.entries(fieldCategories).map(([categoryName, fields]) => {
        if (fields.length === 0) return null;
        
        return (
          <div key={categoryName} className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              {categoryName === 'Contact Information' && <Mail className="h-4 w-4" />}
              {categoryName === 'Business Profile' && <Building className="h-4 w-4" />}
              {categoryName === 'Financial Information' && <UserIcon className="h-4 w-4" />}
              {categoryName}
              {categoryName === 'Financial Information' && ` (${user.buyer_type})`}
            </h4>
            <div className="pl-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {fields.map((fieldKey) => {
                const fieldLabel = FIELD_LABELS[fieldKey as keyof typeof FIELD_LABELS] || fieldKey;
                const fieldValue = user[fieldKey as keyof User];
                
                // Handle special field rendering
                if (fieldKey === 'website' && fieldValue) {
                  return (
                    <div key={fieldKey} className="flex items-center gap-2">
                      <span className="text-muted-foreground">{fieldLabel}:</span>
                      <a href={fieldValue as string} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        {fieldValue as string} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  );
                }
                
                if (fieldKey === 'linkedin_profile' && fieldValue) {
                  return (
                    <div key={fieldKey} className="flex items-center gap-2">
                      <span className="text-muted-foreground">{fieldLabel}:</span>
                      <a href={fieldValue as string} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        <Linkedin className="h-3 w-3" />
                        Profile
                      </a>
                    </div>
                  );
                }
                
                if (fieldKey === 'business_categories') {
                  return (
                    <div key={fieldKey} className="col-span-2">
                      <span className="text-muted-foreground">{fieldLabel}:</span>
                      <div className="mt-1">
                        {fieldValue && Array.isArray(fieldValue) && fieldValue.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {fieldValue.map((cat, index) => (
                              <span key={index} className="text-xs bg-muted px-2 py-1 rounded">
                                {cat}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </div>
                    </div>
                  );
                }
                
                if (fieldKey === 'ideal_target_description' || fieldKey === 'specific_business_search') {
                  return (
                    <div key={fieldKey} className="col-span-2">
                      <span className="text-muted-foreground">{fieldLabel}:</span>
                      <p className="mt-1 text-xs leading-relaxed">{fieldValue as string || '—'}</p>
                    </div>
                  );
                }
                
                if (fieldKey === 'revenue_range_min' || fieldKey === 'revenue_range_max') {
                  const numValue = fieldValue as number;
                  return (
                    <div key={fieldKey}>
                      <span className="text-muted-foreground">{fieldLabel}:</span> 
                      {numValue ? `$${numValue.toLocaleString()}` : '—'}
                    </div>
                  );
                }
                
                // Skip funded_by if user is not funded
                if (fieldKey === 'funded_by' && user.is_funded !== 'yes') {
                  return null;
                }
                
                // Default field rendering
                return (
                  <div key={fieldKey}>
                    <span className="text-muted-foreground">{fieldLabel}:</span> {fieldValue as string || '—'}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Saved Listings Section */}
      <div className="space-y-3">
        <UserSavedListings userId={user.id} />
      </div>
    </div>
  );
};

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
            <TableHead className="text-center">Profile</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-sm">
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
                    <UserDataCompleteness user={user} size="sm" />
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
                    <TableCell colSpan={7} className="py-2 px-4 bg-muted/30 border-t">
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
