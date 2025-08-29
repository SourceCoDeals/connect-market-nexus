import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { 
  LayoutDashboard, 
  Users, 
  Store, 
  MessageSquare, 
  ShoppingBag,
  ChevronRight,
  GitBranch,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminNavbar } from "./AdminNavbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

const AdminLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Admin sidebar */}
      <aside 
        className={cn(
          "bg-card/50 backdrop-blur-sm border-r border-border/50 flex-shrink-0 transition-all duration-300 ease-in-out hidden md:block",
          "hover:shadow-lg",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
        onMouseEnter={() => setSidebarCollapsed(false)}
        onMouseLeave={() => setSidebarCollapsed(true)}
      >
        <div className="flex flex-col h-full p-4">
          {/* Header */}
          <div className={cn(
            "mb-8 transition-all duration-300",
            sidebarCollapsed && "opacity-0 scale-95"
          )}>
            {!sidebarCollapsed && (
              <>
                <h2 className="text-xl font-bold mb-1 bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  Admin Dashboard
                </h2>
                <p className="text-sm text-muted-foreground">
                  Welcome, {user?.first_name || 'Admin'}
                </p>
              </>
            )}
          </div>
          
          {/* Toggle button for collapsed state */}
          {sidebarCollapsed && (
            <div className="mb-4 flex justify-center">
              <Button 
                variant="ghost" 
                size="sm"
                className="h-10 w-10 p-0 hover:bg-primary/10"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <nav className="space-y-2 flex-1">
            <NavLink 
              to="/admin" 
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Dashboard"
              isActive={location.pathname === '/admin'}
              collapsed={sidebarCollapsed}
            />
            <NavLink 
              to="/admin/users" 
              icon={<Users className="h-4 w-4" />}
              label="Users"
              isActive={location.pathname.includes('/admin/users')}
              collapsed={sidebarCollapsed}
            />
            <NavLink 
              to="/admin/listings" 
              icon={<Store className="h-4 w-4" />}
              label="Listings"
              isActive={location.pathname.includes('/admin/listings')}
              collapsed={sidebarCollapsed}
            />
            <NavLink 
              to="/admin/requests" 
              icon={<MessageSquare className="h-4 w-4" />}
              label="Connection Requests"
              isActive={location.pathname.includes('/admin/requests')}
              collapsed={sidebarCollapsed}
            />
            <NavLink 
              to="/admin/pipeline" 
              icon={<GitBranch className="h-4 w-4" />}
              label="Deals Pipeline"
              isActive={location.pathname.includes('/admin/pipeline')}
              collapsed={sidebarCollapsed}
            />
            <NavLink 
              to="/" 
              icon={<ShoppingBag className="h-4 w-4" />}
              label="View Marketplace"
              isActive={false}
              collapsed={sidebarCollapsed}
            />
          </nav>
        </div>
      </aside>
      
      <div className="flex flex-col flex-1">
        {/* Mobile nav */}
        <AdminNavbar className="md:hidden" />
        
        {/* Main content */}
        <main className={cn(
          "flex-1 overflow-auto w-full min-w-0 bg-background/50",
          location.pathname.includes('/admin/pipeline') ? "p-0" : "p-4 sm:p-6 md:p-8"
        )}>
          <div className="max-w-full">
            <Outlet />
          </div>
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
  collapsed?: boolean;
}

const NavLink = ({ to, icon, label, isActive, collapsed }: NavLinkProps) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center px-3 py-3 text-sm rounded-lg transition-all duration-200 group relative",
        "hover:scale-105 hover:shadow-sm",
        isActive 
          ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-medium shadow-md" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:shadow-sm",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? label : undefined}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "mr-3")}>
        {icon}
      </div>
      
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {!isActive && (
            <ChevronRight className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-1" />
          )}
        </>
      )}
      
      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-card text-card-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </Link>
  );
};

export default AdminLayout;
