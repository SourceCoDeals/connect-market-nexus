import { Bell, CheckCheck, Clock, ListTodo } from 'lucide-react';
import { useAdminNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead, GroupedNotification } from '@/hooks/admin/use-admin-notifications';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export function AdminNotificationBell() {
  const { notifications, unreadCount, isLoading } = useAdminNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: GroupedNotification) => {
    // Mark as read (including grouped notifications)
    const idsToMark = notification.groupedIds || [notification.id];
    markAsRead.mutate(idsToMark);

    // Navigate based on action URL
    if (notification.action_url) {
      navigate(notification.action_url);
      setOpen(false);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <ListTodo className="w-4 h-4 text-primary" />;
      case 'task_completed':
        return <CheckCheck className="w-4 h-4 text-green-600" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);
  const hasUnread = unreadCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications ${hasUnread ? `(${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <>
              {/* Red dot indicator */}
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background" />
              {/* Pulse animation for new notifications */}
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all as read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Unread notifications first */}
              {unreadNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    !notification.is_read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {getNotificationIcon(notification.notification_type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {notification.title}
                          {notification.groupedCount && notification.groupedCount > 1 && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground">
                              {notification.groupedCount}
                            </span>
                          )}
                        </p>
                        {!notification.is_read && (
                          <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.metadata?.deal_title && (
                        <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                          <span className="font-medium">{notification.metadata.deal_title}</span>
                          {notification.metadata.priority && (
                            <span className={cn(
                              "px-1 py-0.5 rounded text-[9px] font-medium uppercase",
                              notification.metadata.priority === 'high' && "bg-red-100 text-red-700",
                              notification.metadata.priority === 'medium' && "bg-yellow-100 text-yellow-700",
                              notification.metadata.priority === 'low' && "bg-blue-100 text-blue-700"
                            )}>
                              {notification.metadata.priority}
                            </span>
                          )}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                        <Clock className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {/* Read notifications */}
              {notifications.filter(n => n.is_read).slice(0, 5).map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 opacity-60"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {getNotificationIcon(notification.notification_type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                        <Clock className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                navigate('/admin/notifications');
                setOpen(false);
              }}
            >
              View all notifications →
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
