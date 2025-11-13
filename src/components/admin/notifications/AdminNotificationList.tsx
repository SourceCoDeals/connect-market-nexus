import { useAdminNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@/hooks/admin/use-admin-notifications';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { CheckCheck, ExternalLink, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function AdminNotificationList() {
  const { notifications, unreadCount, isLoading } = useAdminNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading notifications...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            className="text-xs"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      <ScrollArea className="h-[400px]">
        {!notifications || notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "p-4 hover:bg-accent cursor-pointer transition-colors",
                  !notification.is_read && "bg-blue-50/50 dark:bg-blue-950/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{notification.title}</p>
                      {!notification.is_read && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {notification.action_url && (
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
