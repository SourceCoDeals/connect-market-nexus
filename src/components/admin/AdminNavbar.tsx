import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { 
  LayoutDashboard, 
  Users, 
  Store, 
  MessageSquare, 
  ShoppingBag,
  Menu,
  X,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminNotificationBell } from "./AdminNotificationBell";
import { useUnviewedDealSourcingCount } from "@/hooks/admin/use-unviewed-deal-sourcing";
import { useUnviewedConnectionRequests } from "@/hooks/admin/use-unviewed-connection-requests";
import { useUnviewedUsers } from "@/hooks/admin/use-unviewed-users";

interface AdminNavbarProps {
  className?: string;
}

export function AdminNavbar({ className }: AdminNavbarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { unviewedCount: unviewedDealSourcingCount } = useUnviewedDealSourcingCount();
  const { unviewedCount: unviewedConnectionRequestsCount } = useUnviewedConnectionRequests();
  const { unviewedCount: unviewedUsersCount } = useUnviewedUsers();

  const navItems = [
    {
      to: "/admin",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4 mr-2" />,
      active: location.pathname === '/admin'
    },
    {
      to: "/admin/users",
      label: "Users",
      icon: <Users className="h-4 w-4 mr-2" />,
      active: location.pathname.includes('/admin/users'),
      badge: unviewedUsersCount
    },
    {
      to: "/admin/listings",
      label: "Listings",
      icon: <Store className="h-4 w-4 mr-2" />,
      active: location.pathname.includes('/admin/listings')
    },
    {
      to: "/admin/requests",
      label: "Connection Requests",
      icon: <MessageSquare className="h-4 w-4 mr-2" />,
      active: location.pathname.includes('/admin/requests'),
      badge: unviewedConnectionRequestsCount
    },
    {
      to: "/admin/deal-sourcing",
      label: "Deal Sourcing",
      icon: <Sparkles className="h-4 w-4 mr-2" />,
      active: location.pathname.includes('/admin/deal-sourcing'),
      badge: unviewedDealSourcingCount
    },
    {
      to: "/marketplace",
      label: "View Marketplace",
      icon: <ShoppingBag className="h-4 w-4 mr-2" />,
      active: false
    },
  ];

  return (
    <div className={cn("flex items-center justify-between p-3 sm:p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="mr-3 sm:mr-4 h-10 w-10">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85%] sm:w-[300px] p-0">
            <SheetHeader className="p-4 pb-2 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg font-semibold">Admin Dashboard</SheetTitle>
                <SheetClose className="rounded-full hover:bg-muted p-2 touch-manipulation">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </SheetClose>
              </div>
              <p className="text-sm text-muted-foreground text-left mt-1">
                Welcome, {user?.first_name || 'Admin'}
              </p>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-4">
              {navItems.map((item) => (
                <SheetClose asChild key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center px-4 py-3 text-sm rounded-lg transition-colors touch-manipulation min-h-[48px]",
                      item.active 
                        ? "bg-primary text-primary-foreground font-medium" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    )}
                  >
                    {item.icon}
                    <span className="font-medium flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge 
                        className="h-5 min-w-[20px] px-2 flex items-center justify-center text-[10px] font-bold tracking-wide ml-auto bg-notification text-notification-foreground border-notification shadow-sm"
                      >
                        {item.badge > 9 ? '9+' : item.badge}
                      </Badge>
                    )}
                  </Link>
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <h1 className="text-base sm:text-lg font-semibold truncate">Admin Panel</h1>
      </div>
      
      <AdminNotificationBell />
    </div>
  );
}
