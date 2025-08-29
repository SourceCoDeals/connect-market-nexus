import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MessageSquare, RefreshCw, ExternalLink } from "lucide-react";
import { useConnectionRequestConflicts } from "@/hooks/admin/use-connection-request-conflicts";
import { Skeleton } from "@/components/ui/skeleton";

export const ConflictAlertsPanel = () => {
  const { data: conflicts, isLoading, refetch } = useConnectionRequestConflicts();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Request Conflicts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-6 w-[80px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeConflicts = conflicts?.filter(c => c.needs_review) || [];

  if (activeConflicts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Request Conflicts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No active conflicts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Request Conflicts ({activeConflicts.length})
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {activeConflicts.map((conflict) => (
          <div key={conflict.request_id} className="border border-border/40 rounded-md p-3 bg-background/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{conflict.user_email}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {conflict.conflict_type === 'duplicate_submission' ? 'Duplicate' : 'Channel Merge'}
              </Badge>
            </div>
            
            <div className="text-xs text-muted-foreground mb-2">
              {conflict.listing_title}
            </div>
            
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Scroll to the specific request in the main table
                  const element = document.querySelector(`[data-request-id="${conflict.request_id}"]`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Request
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};