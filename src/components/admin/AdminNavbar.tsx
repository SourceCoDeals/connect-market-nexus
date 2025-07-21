
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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdminNavbarProps {
  className?: string;
}

export function AdminNavbar({ className }: AdminNavbarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();

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
      active: location.pathname.includes('/admin/users')
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
      active: location.pathname.includes('/admin/requests')
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
      <div className="flex items-center">
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
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <h1 className="text-base sm:text-lg font-semibold truncate">Admin Panel</h1>
      </div>
    </div>
  );
}
