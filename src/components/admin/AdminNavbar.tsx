
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { 
  LayoutDashboard, 
  Users, 
  Store, 
  MessageSquare, 
  ShoppingBag,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface AdminNavbarProps {
  className?: string;
}

export function AdminNavbar({ className }: AdminNavbarProps) {
  const { user } = useAuth();
  const location = useLocation();

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
    <div className={cn("flex items-center justify-between p-4 border-b", className)}>
      <div className="flex items-center">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="mr-4">
              <Menu className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader className="pb-5">
              <SheetTitle>Admin Dashboard</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                    item.active 
                      ? "bg-primary text-primary-foreground font-medium" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold">Admin Panel</h1>
      </div>
    </div>
  );
}
