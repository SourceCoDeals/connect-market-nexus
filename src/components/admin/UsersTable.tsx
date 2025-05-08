
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { User } from '@/types';
import { CheckCircle, XCircle } from 'lucide-react';

interface UsersTableProps {
  users: User[];
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  onMakeAdmin: (user: User) => void;
  onRevokeAdmin: (user: User) => void;
  isLoading: boolean;
}

export const UsersTable = ({
  users,
  onApprove,
  onReject,
  onMakeAdmin,
  onRevokeAdmin,
  isLoading,
}: UsersTableProps) => {
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500">Rejected</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-500">Pending</Badge>;
    }
  };

  const getBuyerTypeDisplay = (buyerType?: string) => {
    switch (buyerType) {
      case "corporate": return "Corporate";
      case "privateEquity": return "Private Equity";
      case "familyOffice": return "Family Office";
      case "searchFund": return "Search Fund";
      case "individual": return "Individual";
      default: return buyerType || "-";
    }
  };

  if (isLoading) {
    return (
      <div className="border rounded-md">
        <div className="h-12 bg-muted/50 rounded-t-md animate-pulse"></div>
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="h-16 border-t bg-background animate-pulse"></div>
          ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="border rounded-md p-8 text-center text-muted-foreground">
        No users found
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Buyer Type</TableHead>
            <TableHead>Registered</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.first_name} {user.last_name}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.company || "-"}</TableCell>
              <TableCell>{getBuyerTypeDisplay(user.buyer_type)}</TableCell>
              <TableCell>
                {user.created_at
                  ? formatDistanceToNow(new Date(user.created_at), {
                      addSuffix: true,
                    })
                  : "-"}
              </TableCell>
              <TableCell>
                {user.is_admin ? (
                  <Badge variant="outline" className="bg-blue-100 border-blue-500 text-blue-700">
                    Admin
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-100 border-gray-300 text-gray-500">
                    User
                  </Badge>
                )}
              </TableCell>
              <TableCell>{getStatusBadge(user.approval_status)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {/* Status Actions */}
                  {user.approval_status === "pending" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-500 hover:bg-green-500 hover:text-white"
                        onClick={() => onApprove(user)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500 hover:bg-red-500 hover:text-white"
                        onClick={() => onReject(user)}
                      >
                        Reject
                      </Button>
                    </>
                  ) : user.approval_status === "rejected" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-500 hover:bg-green-500 hover:text-white"
                      onClick={() => onApprove(user)}
                    >
                      Approve
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => onReject(user)}
                    >
                      Revoke
                    </Button>
                  )}

                  {/* Admin Actions */}
                  {!user.is_admin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500 hover:bg-blue-500 hover:text-white ml-2"
                      onClick={() => onMakeAdmin(user)}
                    >
                      Make Admin
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-500 hover:bg-gray-500 hover:text-white ml-2"
                      onClick={() => onRevokeAdmin(user)}
                    >
                      Revoke Admin
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
