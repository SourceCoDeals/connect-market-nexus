import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface TriggerLog {
  id: string;
  trigger_name: string;
  user_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export function TriggerHealthMonitor() {
  const queryClient = useQueryClient();

  // Fetch recent trigger failures (last 24 hours)
  const { data: recentFailures, isLoading, refetch } = useQuery({
    queryKey: ['trigger-health'],
    queryFn: async (): Promise<TriggerLog[]> => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('trigger_logs')
        .select('id, trigger_name, user_id, status, error_message, created_at, metadata')
        .eq('status', 'error')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as TriggerLog[];
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Manual sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-missing-profiles', {
        body: { source: 'manual-admin-trigger' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Sync completed",
        description: `Created ${data.profilesCreated || 0} profiles. Errors: ${data.errors || 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ['trigger-health'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message,
      });
    },
  });

  const failureCount = recentFailures?.length || 0;
  const hasFailures = failureCount > 0;

  if (isLoading) {
    return (
      <Card className="border-muted">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Checking trigger health...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasFailures ? "border-destructive/50 bg-destructive/5" : "border-green-500/30 bg-green-500/5"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasFailures ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            <CardTitle className="text-base">
              {hasFailures ? "Trigger Issues Detected" : "Triggers Healthy"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
            <Button
              variant={hasFailures ? "destructive" : "outline"}
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sync Missing Profiles
                </>
              )}
            </Button>
          </div>
        </div>
        <CardDescription>
          {hasFailures 
            ? `${failureCount} trigger failure${failureCount === 1 ? '' : 's'} in the last 24 hours`
            : "All user creation triggers working correctly"
          }
        </CardDescription>
      </CardHeader>
      
      {hasFailures && (
        <CardContent className="pt-0">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentFailures?.map((failure) => (
              <div 
                key={failure.id} 
                className="flex items-start justify-between p-2 rounded-md bg-background border text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      {failure.trigger_name}
                    </Badge>
                    <span className="text-muted-foreground text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(failure.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-destructive mt-1 truncate">
                    {failure.error_message || 'Unknown error'}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5 font-mono">
                    User: {failure.user_id.slice(0, 8)}...
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Click "Sync Missing Profiles" to recover any users who didn't get profiles created.
            This also runs automatically every hour.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
