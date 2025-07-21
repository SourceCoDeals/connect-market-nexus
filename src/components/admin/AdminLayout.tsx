import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { 
  LayoutDashboard, 
  Users, 
  Store, 
  MessageSquare, 
  ShoppingBag,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminNavbar } from "./AdminNavbar";
import { useIsMobile } from "@/hooks/use-mobile";

const AdminLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen w-full">
      {/* Admin sidebar */}
      <aside className="w-64 bg-muted/30 border-r border-border flex-shrink-0 p-4 hidden md:block">
        <div className="flex flex-col h-full">
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-1">Admin Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Welcome, {user?.first_name || 'Admin'}
            </p>
          </div>
          
          <nav className="space-y-1 flex-1">
            <NavLink 
              to="/admin" 
              icon={<LayoutDashboard className="h-4 w-4 mr-2" />}
              label="Dashboard"
              isActive={location.pathname === '/admin'}
            />
            <NavLink 
              to="/admin/users" 
              icon={<Users className="h-4 w-4 mr-2" />}
              label="Users"
              isActive={location.pathname.includes('/admin/users')}
            />
            <NavLink 
              to="/admin/listings" 
              icon={<Store className="h-4 w-4 mr-2" />}
              label="Listings"
              isActive={location.pathname.includes('/admin/listings')}
            />
            <NavLink 
              to="/admin/requests" 
              icon={<MessageSquare className="h-4 w-4 mr-2" />}
              label="Connection Requests"
              isActive={location.pathname.includes('/admin/requests')}
            />
            <NavLink 
              to="/" 
              icon={<ShoppingBag className="h-4 w-4 mr-2" />}
              label="View Marketplace"
              isActive={false}
            />
          </nav>
        </div>
      </aside>
      
      <div className="flex flex-col flex-1">
        {/* Mobile nav */}
        <AdminNavbar className="md:hidden" />
        
        {/* Main content */}
        <main className="flex-1 overflow-auto p-3 md:p-6 lg:p-8 w-full min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
}

const NavLink = ({ to, icon, label, isActive }: NavLinkProps) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
        isActive 
          ? "bg-primary text-primary-foreground font-medium" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {icon}
      <span>{label}</span>
      {!isActive && <ChevronRight className="h-4 w-4 ml-auto opacity-50" />}
    </Link>
  );
};

export default AdminLayout;
