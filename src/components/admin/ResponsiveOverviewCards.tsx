import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, Users, MessageSquare, TrendingUp, Activity, RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress, triggerHaptic } from "@/hooks/use-mobile-gestures";
import { useLazyComponent, usePerformanceMetrics } from "@/hooks/use-mobile-performance";
import { cn } from "@/lib/utils";

interface OverviewCardsProps {
  stats: {
    totalListings?: number;
    pendingUsers?: number;
    pendingConnections?: number;
    totalUsers?: number;
  };
  isLoading: boolean;
  onRefresh?: () => void;
}

export function ResponsiveOverviewCards({ stats, isLoading, onRefresh }: OverviewCardsProps) {
  const isMobile = useIsMobile();
  const { shouldReduceAnimations } = usePerformanceMetrics();
  const { isVisible, ref } = useLazyComponent({ enabled: isMobile });
  
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (onRefresh) {
        triggerHaptic({ type: 'medium' });
        onRefresh();
      }
    },
    threshold: 800,
  });

  const cards = [
    {
      title: 'Active Listings',
      value: stats?.totalListings || 0,
      icon: Store,
      description: 'Available marketplace listings',
      color: 'blue',
      gradient: 'from-blue-50 to-blue-100/50',
      border: 'border-blue-200',
      textColor: 'text-blue-900',
      iconColor: 'text-blue-600',
      descColor: 'text-blue-700'
    },
    {
      title: 'Pending Users',
      value: stats?.pendingUsers || 0,
      icon: Users,
      description: 'Awaiting approval',
      color: 'orange',
      gradient: 'from-orange-50 to-orange-100/50',
      border: 'border-orange-200',
      textColor: 'text-orange-900',
      iconColor: 'text-orange-600',
      descColor: 'text-orange-700'
    },
    {
      title: 'New Connections',
      value: stats?.pendingConnections || 0,
      icon: MessageSquare,
      description: 'Recent connection requests',
      color: 'purple',
      gradient: 'from-purple-50 to-purple-100/50',
      border: 'border-purple-200',
      textColor: 'text-purple-900',
      iconColor: 'text-purple-600',
      descColor: 'text-purple-700'
    },
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: TrendingUp,
      description: 'Registered platform users',
      color: 'green',
      gradient: 'from-green-50 to-green-100/50',
      border: 'border-green-200',
      textColor: 'text-green-900',
      iconColor: 'text-green-600',
      descColor: 'text-green-700'
    }
  ];

  if (isLoading) {
    return (
      <div className={cn(
        "grid gap-3 md:gap-4",
        isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"
      )}>
        {cards.map((_, index) => (
          <Card key={index} className="p-3 md:p-4 animate-pulse">
            <CardHeader className="p-0 pb-2">
              <div className="h-3 w-16 bg-muted rounded mb-2"></div>
              <div className="h-6 w-20 bg-muted rounded"></div>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="h-3 w-24 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      "grid gap-3 md:gap-4",
      isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"
    )}>
      {cards.map((card, index) => (
        <Card 
          key={index} 
          className={cn(
            "p-3 md:p-4 transition-all duration-200 hover:shadow-md",
            isMobile && `bg-gradient-to-br ${card.gradient} ${card.border}`
          )}
        >
          <CardHeader className="p-0 pb-2">
            <CardDescription className="flex items-center justify-between text-xs md:text-sm">
              <div className="flex items-center gap-1">
                <card.icon className={cn(
                  "h-4 w-4",
                  isMobile ? card.iconColor : "text-muted-foreground"
                )} />
                <span className={cn(
                  isMobile && card.iconColor
                )}>{card.title}</span>
              </div>
              {isMobile && (
                <Badge variant="outline" className={cn(
                  "text-xs",
                  `bg-${card.color}-100 ${card.iconColor}`
                )}>
                  {card.value > 0 ? 'Active' : 'None'}
                </Badge>
              )}
            </CardDescription>
            <CardTitle className={cn(
              "text-lg md:text-2xl font-bold",
              isMobile && card.textColor
            )}>
              {card.value.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <p className={cn(
              "text-xs md:text-sm",
              isMobile ? card.descColor : "text-muted-foreground"
            )}>
              {card.description}
            </p>
            {isMobile && card.value > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Activity className="h-3 w-3 text-current animate-pulse" />
                <span className="text-xs font-medium">Live data</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}