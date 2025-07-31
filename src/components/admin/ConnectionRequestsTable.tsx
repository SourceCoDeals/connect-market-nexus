
import React, { useState } from 'react';
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
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

interface ConnectionRequestsTableProps {
  requests: AdminConnectionRequest[];
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
  isLoading: boolean;
}

// Smaller component for table loading state
const ConnectionRequestsTableSkeleton = () => (
  <div className="border rounded-md">
    <div className="h-12 bg-muted/50 rounded-t-md animate-pulse"></div>
    {Array(5)
      .fill(0)
      .map((_, i) => (
        <div key={i} className="h-16 border-t bg-background animate-pulse"></div>
      ))}
  </div>
);

// Smaller component for empty state
const ConnectionRequestsTableEmpty = () => (
  <div className="border rounded-md p-8 text-center text-muted-foreground">
    No connection requests found
  </div>
);

// Smaller component for request details
const RequestDetails = ({ request, onApprove, onReject }: { 
  request: AdminConnectionRequest;
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
}) => (
  <div className="mt-4 flex flex-col space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h4 className="font-semibold text-sm mb-2">Buyer Details</h4>
        <div className="space-y-1 text-sm">
          <p><span className="font-medium">Name:</span> {request.user ? `${request.user.first_name} ${request.user.last_name}` : "Unknown User"}</p>
          <p><span className="font-medium">Email:</span> {request.user?.email || "-"}</p>
          <p><span className="font-medium">Company:</span> {request.user?.company || "-"}</p>
          <p><span className="font-medium">Phone:</span> {request.user?.phone_number || "-"}</p>
          <p><span className="font-medium">Buyer Type:</span> {request.user?.buyer_type || "-"}</p>
          <p><span className="font-medium">Fee Agreement:</span> 
            <Badge variant={request.user?.fee_agreement_signed ? "success" : "secondary"} className="ml-2">
              {request.user?.fee_agreement_signed ? "Signed" : "Not Signed"}
            </Badge>
          </p>
        </div>
      </div>
      
      <div>
        <h4 className="font-semibold text-sm mb-2">Listing Details</h4>
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-medium">Title:</span>{" "}
            {request.listing?.id ? (
              <Link to={`/listing/${request.listing.id}`} className="text-primary hover:underline">
                {request.listing.title || "Unknown"}
              </Link>
            ) : (
              request.listing?.title || "Unknown"
            )}
          </p>
          <p><span className="font-medium">Category:</span> {request.listing?.category || "-"}</p>
          <p><span className="font-medium">Location:</span> {request.listing?.location || "-"}</p>
          <p><span className="font-medium">Revenue:</span> {request.listing?.revenue ? `$${(request.listing.revenue).toLocaleString()}` : "-"}</p>
          <p><span className="font-medium">EBITDA:</span> {request.listing?.ebitda ? `$${(request.listing.ebitda).toLocaleString()}` : "-"}</p>
        </div>
      </div>
    </div>
    
    {request.user_message && (
      <div className="mt-4">
        <h4 className="font-semibold text-sm mb-2">Buyer's Message</h4>
        <div className="bg-muted p-3 rounded-md text-sm">
          {request.user_message}
        </div>
      </div>
    )}
    
    {request.admin_comment && (
      <div className="mt-4">
        <h4 className="font-semibold text-sm mb-2">Admin Comment</h4>
        <div className="bg-muted p-3 rounded-md text-sm">
          {request.admin_comment}
        </div>
      </div>
    )}
    
    <div className="mt-4 flex justify-end gap-2">
      {request.status === "pending" ? (
        <>
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
        </>
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
    </div>
  </div>
);

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
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

export const ConnectionRequestsTable = ({
  requests,
  onApprove,
  onReject,
  isLoading,
}: ConnectionRequestsTableProps) => {
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  
  const toggleExpand = (requestId: string) => {
    setExpandedRequestId(expandedRequestId === requestId ? null : requestId);
  };

  if (isLoading) {
    return <ConnectionRequestsTableSkeleton />;
  }

  if (requests.length === 0) {
    return <ConnectionRequestsTableEmpty />;
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Listing</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <React.Fragment key={request.id}>
                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(request.id)}>
                  <TableCell className="w-8">
                    {expandedRequestId === request.id ? 
                      <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </TableCell>
                  <TableCell className="font-medium">
                    {request.user ? `${request.user.first_name} ${request.user.last_name}` : "Unknown User"}
                  </TableCell>
                  <TableCell>{request.user?.email || "-"}</TableCell>
                  <TableCell>{request.user?.company || "-"}</TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {request.listing?.id ? (
                      <Link 
                        to={`/listing/${request.listing.id}`} 
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {request.listing?.title || "Unknown Listing"}
                      </Link>
                    ) : (
                      request.listing?.title || "Unknown Listing"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[150px]">
                    {request.user_message ? (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate text-xs" title={request.user_message}>
                          {request.user_message}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">No message</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(request.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {request.status === "pending" ? (
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onApprove(request);
                        }}
                      >
                        Approve
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500 hover:bg-red-500 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject(request);
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                
                {expandedRequestId === request.id && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-4 px-6 bg-muted/30 border-t">
                      <RequestDetails 
                        request={request} 
                        onApprove={onApprove} 
                        onReject={onReject}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
