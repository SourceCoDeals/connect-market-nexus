
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
import { AdminConnectionRequest } from '@/types/admin';
import { CheckCircle, XCircle } from 'lucide-react';

interface ConnectionRequestsTableProps {
  requests: AdminConnectionRequest[];
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
  isLoading: boolean;
}

export const ConnectionRequestsTable = ({
  requests,
  onApprove,
  onReject,
  isLoading,
}: ConnectionRequestsTableProps) => {
  const getStatusBadge = (status: string) => {
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

  if (requests.length === 0) {
    return (
      <div className="border rounded-md p-8 text-center text-muted-foreground">
        No connection requests found
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Buyer</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Listing</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">
                {request.user ? `${request.user.first_name} ${request.user.last_name}` : "Unknown User"}
              </TableCell>
              <TableCell>{request.user?.email || "-"}</TableCell>
              <TableCell>{request.user?.company || "-"}</TableCell>
              <TableCell className="max-w-[180px] truncate">
                {request.listing?.title || "Unknown Listing"}
              </TableCell>
              <TableCell>{request.listing?.category || "-"}</TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(request.created_at), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>{getStatusBadge(request.status)}</TableCell>
              <TableCell className="text-right">
                {request.status === "pending" ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-500 hover:bg-green-500 hover:text-white"
                      onClick={() => onApprove(request)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => onReject(request)}
                    >
                      Reject
                    </Button>
                  </div>
                ) : request.status === "rejected" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-500 hover:bg-green-500 hover:text-white"
                    onClick={() => onApprove(request)}
                  >
                    Approve
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500 hover:bg-red-500 hover:text-white"
                    onClick={() => onReject(request)}
                  >
                    Revoke
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
