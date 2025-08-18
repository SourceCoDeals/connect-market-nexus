import React, { useState, useCallback, memo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, User, Building, MessageSquare, Calendar, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminConnectionRequest } from "@/types/admin";
import { ConnectionRequestActions } from "@/components/admin/ConnectionRequestActions";
import { StatusIndicatorRow } from "./StatusIndicatorRow";
import { WorkflowProgressIndicator } from "./WorkflowProgressIndicator";
import { InternalCompanyInfoDisplay } from "./InternalCompanyInfoDisplay";
import { useOptimizedConnectionRequests } from "@/hooks/admin/requests/use-optimized-connection-requests";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OptimizedConnectionRequestsTableProps {
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
  onRefresh?: () => void;
  stats?: {
    totalUsers: number;
    pendingUsers: number;
    approvedUsers: number;
    totalListings: number;
    pendingConnections: number;
    approvedConnections: number;
  };
}

// Memoized status badge for better performance
const StatusBadge = memo(({ status }: { status: string }) => {
  const variants = {
    approved: "bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    rejected: "bg-red-500/10 text-red-700 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30", 
    pending: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
  };
  
  const icons = {
    approved: "✓",
    rejected: "✕",
    pending: "⏳"
  };
  
  return (
    <Badge variant="outline" className={`text-xs font-medium px-2.5 py-1 ${variants[status as keyof typeof variants]}`}>
      <span className="mr-1">{icons[status as keyof typeof icons]}</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
});

// Memoized skeleton loader
const ConnectionRequestsTableSkeleton = memo(() => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <Card key={i}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-3 w-[200px]" />
              </div>
            </div>
            <Skeleton className="h-6 w-[80px]" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
));

// Memoized empty state
const ConnectionRequestsTableEmpty = memo(() => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-16">
      <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold text-muted-foreground mb-2">No connection requests found</h3>
      <p className="text-sm text-muted-foreground">Connection requests will appear here when users submit them.</p>
    </CardContent>
  </Card>
));

// Memoized request card for better rendering performance
const OptimizedRequestCard = memo(({ 
  request, 
  onApprove, 
  onReject, 
  expandedRequestId, 
  onToggleExpand 
}: {
  request: AdminConnectionRequest;
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
  expandedRequestId: string | null;
  onToggleExpand: (id: string) => void;
}) => {
  const navigate = useNavigate();
  const [localUser, setLocalUser] = useState(request.user);

  const handleListingClick = useCallback(() => {
    if (request.listing?.id) {
      navigate(`/listing/${request.listing.id}`);
    }
  }, [request.listing?.id, navigate]);

  const handleLocalStateUpdate = useCallback((updatedUser: any) => {
    setLocalUser(updatedUser);
  }, []);

  const handleToggleExpand = useCallback(() => {
    onToggleExpand(request.id);
  }, [request.id, onToggleExpand]);

  return (
    <Card className="group border border-border/30 hover:border-border/60 hover:shadow-sm transition-all duration-200 bg-card/50 hover:bg-card">
      <Collapsible 
        open={expandedRequestId === request.id}
        onOpenChange={handleToggleExpand}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer p-6 hover:bg-accent/5 transition-colors">
            <div className="space-y-4">
              {/* Header Row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar className="h-12 w-12 border-2 border-border/20">
                    <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                      {localUser?.first_name?.[0]}{localUser?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-base text-foreground">
                        {localUser?.first_name} {localUser?.last_name}
                      </h3>
                      <StatusBadge status={request.status} />
                    </div>
                    
                    {/* Company info */}
                    {(request.listing as any)?.internal_company_name && (
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground flex-wrap">
                        <Building className="h-4 w-4 flex-shrink-0 text-slate-600" />
                        <span className="truncate">{(request.listing as any).internal_company_name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{localUser?.company}</span>
                      <span className="text-border">•</span>
                      <span className="truncate">{localUser?.email}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <Building className="h-4 w-4 flex-shrink-0 text-primary/60" />
                      <span className="truncate font-medium">{request.listing?.title}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(request.created_at).toLocaleDateString()}
                  </div>
                  <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-all duration-200 data-[state=open]:rotate-180" />
                </div>
              </div>
              
              {/* Status Indicators Row */}
              {localUser && (
                <div className="border-t border-border/30 pt-4">
                  <div className="space-y-2">
                    <StatusIndicatorRow 
                      user={localUser} 
                      followedUp={request.followed_up || false} 
                      negativeFollowedUp={request.negative_followed_up || false}
                      followedUpByAdmin={request.followedUpByAdmin}
                      negativeFollowedUpByAdmin={request.negativeFollowedUpByAdmin}
                      followedUpAt={request.followed_up_at}
                      negativeFollowedUpAt={request.negative_followed_up_at}
                    />
                    <WorkflowProgressIndicator user={localUser} followedUp={request.followed_up || false} />
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 px-6 pb-6">
            {/* Quick Actions */}
            <div className="mb-6 p-6 bg-accent/30 rounded-lg border border-border/30">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-semibold text-lg">Actions & Status</h4>
                <div className="flex gap-3">
                  {request.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                        onClick={() => onApprove(request)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500 text-red-700 hover:bg-red-500 hover:text-white px-4 py-2"
                        onClick={() => onReject(request)}
                      >
                        Reject
                      </Button>
                    </>
                  ) : request.status === "rejected" ? (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                      onClick={() => onApprove(request)}
                    >
                      Approve
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500 text-red-700 hover:bg-red-500 hover:text-white px-4 py-2"
                      onClick={() => onReject(request)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>

              {localUser && (
                <ConnectionRequestActions
                  user={localUser}
                  listing={request.listing}
                  requestId={request.id}
                  followedUp={request.followed_up || false}
                  negativeFollowedUp={request.negative_followed_up || false}
                  onLocalStateUpdate={handleLocalStateUpdate}
                />
              )}
            </div>

            {/* Additional Details */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Message */}
                {request.user_message && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Buyer Message
                    </h4>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-700 leading-relaxed">{request.user_message}</p>
                    </div>
                  </div>
                )}

                {/* Listing Info */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-base flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Listing Information
                  </h4>
                  <div className="bg-card border rounded-lg p-4 space-y-3">
                    <button
                      onClick={handleListingClick}
                      className="font-medium text-primary hover:text-primary/80 text-left transition-colors"
                    >
                      {request.listing?.title}
                    </button>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Category:</span>
                        <p>{request.listing?.category}</p>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Location:</span>
                        <p>{request.listing?.location}</p>
                      </div>
                    </div>
                  </div>
                  
                  {request.listing && <InternalCompanyInfoDisplay listing={request.listing as any} />}
                </div>
              </div>

              {/* Admin Response */}
              {request.admin_comment && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-base">Admin Response</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-700 leading-relaxed">{request.admin_comment}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});

export const OptimizedConnectionRequestsTable = ({
  onApprove,
  onReject,
  onRefresh,
  stats,
}: OptimizedConnectionRequestsTableProps) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(50); // Increased default page size
  const [showAll, setShowAll] = useState(false);

  const { data: result, isLoading, isError } = useOptimizedConnectionRequests({
    page: showAll ? 1 : page,
    pageSize: showAll ? 10000 : pageSize, // Large number for "show all"
    search,
    status: status === 'all' ? '' : status,
  });

  const requests = result?.data || [];
  const totalPages = result?.totalPages || 0;
  const totalCount = result?.count || 0;

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedRequestId(prev => prev === id ? null : id);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page when searching
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setStatus(value);
    setPage(1); // Reset to first page when filtering
  }, []);

  const handleShowAllToggle = useCallback(() => {
    setShowAll(prev => !prev);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    const size = parseInt(newPageSize);
    setPageSize(size);
    setPage(1);
    setShowAll(false);
  }, []);

  if (isLoading) {
    return <ConnectionRequestsTableSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <h3 className="text-xl font-semibold text-destructive mb-2">Error loading requests</h3>
          <p className="text-sm text-muted-foreground mb-4">There was an error loading connection requests.</p>
          <Button onClick={onRefresh} variant="outline">Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-primary">{stats.totalUsers}</div>
            <div className="text-sm text-muted-foreground">Total Users</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{stats.pendingUsers}</div>
            <div className="text-sm text-muted-foreground">Pending Users</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.approvedUsers}</div>
            <div className="text-sm text-muted-foreground">Approved Users</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.totalListings}</div>
            <div className="text-sm text-muted-foreground">Total Listings</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.pendingConnections}</div>
            <div className="text-sm text-muted-foreground">Pending Requests</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{stats.approvedConnections}</div>
            <div className="text-sm text-muted-foreground">Approved Requests</div>
          </Card>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requests by name, email, company, or listing..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Select value={showAll ? "all" : pageSize.toString()} onValueChange={(value) => {
            if (value === "all") {
              handleShowAllToggle();
            } else {
              handlePageSizeChange(value);
            }
          }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
              <SelectItem value="all">Show All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {requests.length} of {totalCount} connection requests
          {search && ` matching "${search}"`}
          {status !== 'all' && ` with status "${status}"`}
          {showAll && " (showing all)"}
        </div>
        {!showAll && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="px-3 py-1 text-xs">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <ConnectionRequestsTableEmpty />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <OptimizedRequestCard
              key={request.id}
              request={request}
              onApprove={onApprove}
              onReject={onReject}
              expandedRequestId={expandedRequestId}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
};