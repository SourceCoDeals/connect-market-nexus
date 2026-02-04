import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Activity, Calendar, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { activityConfig, type ActivityType } from "@/lib/ma-intelligence/activityTypes";

interface TrackerActivityTabProps {
  trackerId: string;
}

interface ActivityRecord {
  id: string;
  activity_type: ActivityType;
  entity_type: 'buyer' | 'deal' | 'tracker';
  entity_id: string | null;
  entity_name: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
}

export function TrackerActivityTab({ trackerId }: TrackerActivityTabProps) {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadActivities();
  }, [trackerId, filterType, dateRange]);

  const loadActivities = async () => {
    if (!trackerId || trackerId === 'new') return;

    setIsLoading(true);
    try {
      // tracker_activities table doesn't exist yet - stub implementation
      // When the table is created, uncomment and use:
      // const { data, error } = await supabase
      //   .from("tracker_activities")
      //   .select("*")
      //   .eq("tracker_id", trackerId)
      //   .order("created_at", { ascending: false })
      //   .limit(100);
      
      // For now, return empty array
      setActivities([]);
    } catch (error: any) {
      toast({
        title: "Error loading activities",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderActivityIcon = (activityType: ActivityType) => {
    const config = activityConfig[activityType];
    const Icon = config.icon;
    return (
      <div className={`w-10 h-10 rounded-lg ${config.bgClass} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${config.colorClass}`} />
      </div>
    );
  };

  const getEntityLink = (activity: ActivityRecord) => {
    if (!activity.entity_id) return null;

    switch (activity.entity_type) {
      case 'buyer':
        return `/admin/ma-intelligence/buyers/${activity.entity_id}`;
      case 'deal':
        return `/admin/ma-intelligence/deals/${activity.entity_id}`;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Feed</CardTitle>
              <CardDescription>
                Recent activity in this buyer universe
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={(value) => setFilterType(value as ActivityType | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="buyer_added">Buyer Added</SelectItem>
                  <SelectItem value="deal_created">Deal Created</SelectItem>
                  <SelectItem value="buyer_scored">Buyer Scored</SelectItem>
                  <SelectItem value="buyer_interested">Buyer Interested</SelectItem>
                  <SelectItem value="buyer_passed">Buyer Passed</SelectItem>
                  <SelectItem value="outreach_approved">Outreach Approved</SelectItem>
                  <SelectItem value="transcript_added">Transcript Added</SelectItem>
                  <SelectItem value="learning_captured">Learning Captured</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={(value) => setDateRange(value as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={loadActivities}
              >
                <Activity className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4" />
              <p>No activity found</p>
              <p className="text-sm">
                {filterType !== 'all' || dateRange !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Activity will appear here as you work with this tracker'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => {
                const entityLink = getEntityLink(activity);

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {renderActivityIcon(activity.activity_type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {entityLink ? (
                            <Link
                              to={entityLink}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {activity.entity_name || 'View Details'}
                            </Link>
                          ) : (
                            <p className="font-medium">{activity.entity_name || 'Activity'}</p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.description}
                          </p>
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {Object.entries(activity.metadata).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                          <Calendar className="w-3 h-3" />
                          {formatRelativeTime(activity.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
