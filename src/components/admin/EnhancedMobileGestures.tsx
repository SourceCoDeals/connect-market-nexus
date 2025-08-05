import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Smartphone, 
  Activity,
  Vibrate,
  ArrowLeft,
  ArrowRight,
  MousePointer
} from "lucide-react";
import { useSwipeGesture, useLongPress, triggerHaptic } from "@/hooks/use-mobile-gestures";
import { usePullToRefresh } from "@/hooks/use-mobile-gestures";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface EnhancedMobileGesturesProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onRefresh?: () => void;
  showGestureHints?: boolean;
}

export function EnhancedMobileGestures({
  children,
  onSwipeLeft,
  onSwipeRight,
  onRefresh,
  showGestureHints = false
}: EnhancedMobileGesturesProps) {
  const isMobile = useIsMobile();
  const [showHints, setShowHints] = useState(showGestureHints);
  const [gestureDetected, setGestureDetected] = useState<string | null>(null);

  // Swipe gesture handlers
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => {
      if (onSwipeLeft) {
        setGestureDetected('swipe-left');
        triggerHaptic({ type: 'light' });
        onSwipeLeft();
        setTimeout(() => setGestureDetected(null), 1000);
      }
    },
    onSwipeRight: () => {
      if (onSwipeRight) {
        setGestureDetected('swipe-right');
        triggerHaptic({ type: 'light' });
        onSwipeRight();
        setTimeout(() => setGestureDetected(null), 1000);
      }
    },
    threshold: 100,
  });

  // Long press for refresh
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (onRefresh) {
        setGestureDetected('long-press');
        triggerHaptic({ type: 'medium' });
        onRefresh();
        setTimeout(() => setGestureDetected(null), 2000);
      }
    },
    threshold: 800,
  });

  // Pull to refresh
  const { isRefreshing, pullDistance, showRefreshIndicator } = usePullToRefresh(
    onRefresh || (() => {}),
    80
  );

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchEnd={swipeHandlers.onTouchEnd}
      {...(onRefresh ? {
        onMouseDown: longPressHandlers.onMouseDown,
        onMouseUp: longPressHandlers.onMouseUp,
        onMouseLeave: longPressHandlers.onMouseLeave,
        onMouseMove: longPressHandlers.onMouseMove,
        onTouchMove: longPressHandlers.onTouchMove,
      } : {})}
    >
      {/* Pull to refresh indicator */}
      {showRefreshIndicator && (
        <div className="absolute top-0 left-0 right-0 z-50 flex justify-center">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-b-lg shadow-lg">
            <RefreshCw className={cn(
              "h-4 w-4 mr-2 inline",
              isRefreshing && "animate-spin"
            )} />
            {isRefreshing ? 'Refreshing...' : 'Release to refresh'}
          </div>
        </div>
      )}

      {/* Gesture feedback overlay */}
      {gestureDetected && (
        <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div className="bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
            {gestureDetected === 'swipe-left' && (
              <div className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Swiped Left</span>
              </div>
            )}
            {gestureDetected === 'swipe-right' && (
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                <span className="text-sm">Swiped Right</span>
              </div>
            )}
            {gestureDetected === 'long-press' && (
              <div className="flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                <span className="text-sm">Long Press Detected</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gesture hints */}
      {showHints && (
        <Card className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Mobile Gestures
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHints(false)}
                className="ml-auto h-6 w-6 p-0"
              >
                ×
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-2 text-xs">
              {onSwipeLeft && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="p-1">
                    <ChevronLeft className="h-3 w-3" />
                  </Badge>
                  <span>Swipe left to navigate</span>
                </div>
              )}
              {onSwipeRight && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="p-1">
                    <ChevronRight className="h-3 w-3" />
                  </Badge>
                  <span>Swipe right to go back</span>
                </div>
              )}
              {onRefresh && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="p-1">
                    <MousePointer className="h-3 w-3" />
                  </Badge>
                  <span>Long press or pull down to refresh</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="p-1">
                  <Vibrate className="h-3 w-3" />
                </Badge>
                <span>Haptic feedback enabled</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {children}
    </div>
  );
}

// Quick action helper for common mobile interactions
export function MobileQuickAction({
  icon: Icon,
  label,
  badge,
  variant = "default",
  onClick,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
  variant?: "default" | "secondary" | "outline";
  onClick: () => void;
  className?: string;
}) {
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      triggerHaptic({ type: 'medium' });
      onClick();
    },
    threshold: 300,
  });

  return (
    <Button
      variant={variant}
      className={cn(
        "h-14 px-4 touch-manipulation active:scale-95 transition-transform",
        "min-h-[44px] relative", // Ensure minimum touch target
        className
      )}
      onClick={onClick}
      {...longPressHandlers}
    >
      <div className="flex items-center gap-3 w-full justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="font-medium">{label}</span>
        </div>
        {badge && badge > 0 && (
          <Badge variant="secondary" className="min-w-[20px] h-5 text-xs">
            {badge}
          </Badge>
        )}
      </div>
    </Button>
  );
}