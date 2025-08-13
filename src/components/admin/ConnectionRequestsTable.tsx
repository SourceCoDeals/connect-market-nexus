import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { PremiumConnectionRequestCard } from "./PremiumConnectionRequestCard";

interface ConnectionRequestsTableProps {
  requests: AdminConnectionRequest[];
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
  isLoading: boolean;
  onRefresh?: () => void;
}

const ConnectionRequestsTableSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="border border-border/60">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-3 flex-1">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-[200px]" />
                  <Skeleton className="h-4 w-[160px]" />
                </div>
                <Skeleton className="h-4 w-[280px]" />
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-[100px]" />
                  <Skeleton className="h-3 w-[120px]" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-[70px]" />
              <Skeleton className="h-8 w-[70px]" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const ConnectionRequestsTableEmpty = () => (
  <Card className="border border-border/60">
    <CardContent className="flex flex-col items-center justify-center py-20">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">No connection requests yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Connection requests from potential buyers will appear here for your review and approval.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export function ConnectionRequestsTable({
  requests,
  onApprove,
  onReject,
  isLoading,
  onRefresh
}: ConnectionRequestsTableProps) {
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());

  const toggleExpand = (requestId: string) => {
    const newExpanded = new Set(expandedRequests);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRequests(newExpanded);
  };

  if (isLoading) {
    return <ConnectionRequestsTableSkeleton />;
  }

  if (!requests || requests.length === 0) {
    return <ConnectionRequestsTableEmpty />;
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <PremiumConnectionRequestCard
          key={request.id}
          request={request}
          onApprove={onApprove}
          onReject={onReject}
          isExpanded={expandedRequests.has(request.id)}
          onToggleExpand={() => toggleExpand(request.id)}
        />
      ))}
    </div>
  );
}