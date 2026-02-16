import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Eye, Heart, MessageSquare, UserPlus, Search as SearchIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useRecentActivity } from "@/hooks/use-recent-activity";
import { useFilterEngine } from "@/hooks/use-filter-engine";
import { FilterBar, ACTIVITY_FIELDS } from "@/components/filters";

export function RecentActivityTab() {
  const [limit, setLimit] = useState(50);

  const { data: activities = [], isLoading, refetch } = useRecentActivity(limit);

  const {
    filteredItems: filteredActivities,
    filterState,
    setFilterState,
    dynamicOptions,
    filteredCount,
    totalCount,
  } = useFilterEngine(activities, ACTIVITY_FIELDS);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'signup': return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'listing_view': return <Eye className="h-4 w-4 text-blue-500" />;
      case 'save': return <Heart className="h-4 w-4 text-red-500" />;
      case 'connection_request': return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case 'search': return <SearchIcon className="h-4 w-4 text-orange-500" />;
      default: return <div className="h-4 w-4 bg-gray-300 rounded-full" />;
    }
  };

  const getActivityBadgeColor = (type: string) => {
    switch (type) {
      case 'signup': return 'default';
      case 'listing_view': return 'secondary';
      case 'save': return 'destructive';
      case 'connection_request': return 'outline';
      case 'search': return 'secondary';
      default: return 'outline';
    }
  };

  const activityTypeCounts = activities.reduce((acc, activity) => {
    acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Recent Activity</h2>
          <p className="text-muted-foreground">Comprehensive view of all marketplace activity</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Activity type overview */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityTypeCounts.signup || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Listing Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityTypeCounts.listing_view || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityTypeCounts.save || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityTypeCounts.connection_request || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Searches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityTypeCounts.search || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <FilterBar
        filterState={filterState}
        onFilterStateChange={setFilterState}
        fieldDefinitions={ACTIVITY_FIELDS}
        dynamicOptions={dynamicOptions}
        totalCount={totalCount}
        filteredCount={filteredCount}
      >
        <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
          <SelectTrigger className="w-24 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {/* Activity list */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex-shrink-0">
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{activity.user_name}</p>
                      <Badge variant={getActivityBadgeColor(activity.activity_type) as any} className="text-xs">
                        {activity.activity_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.user_email}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                    {activity.metadata?.listing_title && (
                      <p className="text-xs text-muted-foreground truncate max-w-32">
                        {activity.metadata.listing_title}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No activities found matching your criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity Insights</CardTitle>
            <CardDescription>Key patterns in user behavior</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Most active users today</span>
                <span className="text-sm font-medium">
                  {[...new Set(filteredActivities.map(a => a.user_email))].length} unique users
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Peak activity time</span>
                <span className="text-sm font-medium">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Conversion rate</span>
                <span className="text-sm font-medium">
                  {activityTypeCounts.listing_view > 0 ?
                    ((activityTypeCounts.connection_request || 0) / activityTypeCounts.listing_view * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Based on recent activity patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activityTypeCounts.connection_request > 5 && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <strong>High connection activity:</strong> Consider following up with interested users
                </div>
              )}
              {activityTypeCounts.search > 10 && (
                <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                  <strong>High search volume:</strong> Review search terms for content gaps
                </div>
              )}
              {activityTypeCounts.signup > 3 && (
                <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                  <strong>New user influx:</strong> Check pending approvals queue
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
