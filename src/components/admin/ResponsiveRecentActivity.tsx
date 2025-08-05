import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ChevronRight, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface ResponsiveRecentActivityProps {
  activities: ActivityItem[];
  isLoading: boolean;
  onRefresh?: () => void;
}

export function ResponsiveRecentActivity({ 
  activities, 
  isLoading, 
  onRefresh 
}: ResponsiveRecentActivityProps) {
  const isMobile = useIsMobile();
  const [showAll, setShowAll] = useState(false);

  const displayedActivities = isMobile && !showAll 
    ? activities.slice(0, 3) 
    : activities.slice(0, 8);

  const getActivityColor = (type: string) => {
    switch (type) {
      case "signup":
        return {
          border: "border-l-green-500",
          bg: "bg-green-50/50",
          dot: "bg-green-500",
          badge: "bg-green-100 text-green-700"
        };
      case "connection_request":
        return {
          border: "border-l-blue-500",
          bg: "bg-blue-50/50",
          dot: "bg-blue-500",
          badge: "bg-blue-100 text-blue-700"
        };
      case "listing_creation":
        return {
          border: "border-l-purple-500",
          bg: "bg-purple-50/50",
          dot: "bg-purple-500",
          badge: "bg-purple-100 text-purple-700"
        };
      default:
        return {
          border: "border-l-gray-500",
          bg: "bg-gray-50/50",
          dot: "bg-gray-500",
          badge: "bg-gray-100 text-gray-700"
        };
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4 md:p-6">
        <CardHeader className="p-0 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 w-32 bg-muted rounded animate-pulse"></div>
              <div className="h-4 w-48 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-3 w-3 bg-muted rounded-full mt-2"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded"></div>
                  <div className="h-3 w-1/2 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-4 md:p-6">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
              {activities.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {activities.length} items
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-sm">
              Latest marketplace actions
            </CardDescription>
          </div>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              {!isMobile && <span className="ml-2">Refresh</span>}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity to display</p>
            <p className="text-xs mt-1">New activities will appear here</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:space-y-4">
              {displayedActivities.map((activity) => {
                const colors = getActivityColor(activity.type);
                return (
                  <div
                    key={activity.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-l-4 transition-all duration-200",
                      colors.border,
                      isMobile ? colors.bg : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "rounded-full p-1.5 mt-0.5 flex-shrink-0",
                      colors.dot
                    )}>
                      <div className="h-2 w-2 bg-white rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium leading-relaxed",
                        isMobile ? "text-sm" : "text-sm"
                      )}>
                        {activity.description}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.timestamp), { 
                            addSuffix: true 
                          })}
                        </p>
                        {isMobile && (
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", colors.badge)}
                          >
                            {activity.type.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!isMobile && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Show More/Less Button for Mobile */}
            {isMobile && activities.length > 3 && (
              <div className="mt-4 text-center">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full"
                >
                  {showAll ? 'Show Less' : `Show ${activities.length - 3} More`}
                  <ChevronRight className={cn(
                    "h-4 w-4 ml-2 transition-transform",
                    showAll && "rotate-90"
                  )} />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}