
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  MessageSquare, 
  LogOut
} from "lucide-react";

interface AdminNavbarProps {
  className?: string;
}

const AdminNavbar: React.FC<AdminNavbarProps> = ({ className }) => {
  const { logout, user } = useAuth();
  
  const navItems = [
    {
      title: "Dashboard",
      href: "/admin/dashboard",
      icon: <LayoutDashboard className="h-5 w-5 mr-2" />,
    },
    {
      title: "Listings",
      href: "/admin/listings",
      icon: <Store className="h-5 w-5 mr-2" />,
    },
    {
      title: "Users",
      href: "/admin/users",
      icon: <Users className="h-5 w-5 mr-2" />,
    },
    {
      title: "Connection Requests",
      href: "/admin/requests",
      icon: <MessageSquare className="h-5 w-5 mr-2" />,
    },
  ];

  return (
    <div className={cn("bg-white border-r border-border h-screen", className)}>
      <div className="p-6 flex flex-col h-full">
        <div className="mb-8">
          <h2 className="font-bold text-xl">Admin Portal</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your marketplace
          </p>
        </div>
        
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium",
                "transition-colors hover:bg-muted",
              )}
            >
              {item.icon}
              {item.title}
            </Link>
          ))}
        </nav>
        
        <div className="pt-4 border-t border-border">
          {user && (
            <div className="mb-4">
              <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => logout()}
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminNavbar;
