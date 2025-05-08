
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronRight, BarChart3, Users, FileText, MessageSquare, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminLayout = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    {
      label: "Dashboard",
      path: "/admin",
      icon: <BarChart3 className="h-4 w-4 mr-2" />,
      exact: true
    },
    {
      label: "Users",
      path: "/admin/users",
      icon: <Users className="h-4 w-4 mr-2" />
    },
    {
      label: "Listings",
      path: "/admin/listings",
      icon: <FileText className="h-4 w-4 mr-2" />
    },
    {
      label: "Connection Requests",
      path: "/admin/requests",
      icon: <MessageSquare className="h-4 w-4 mr-2" />
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-primary text-primary-foreground px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="text-lg font-bold">Admin Dashboard</div>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/marketplace" className="flex items-center">
              <Store className="h-4 w-4 mr-2" />
              View Marketplace
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-muted flex-shrink-0">
          <nav className="p-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? currentPath === item.path
                  : currentPath.startsWith(item.path);
                
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        "flex items-center px-4 py-2 rounded-md text-sm",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted-foreground/10"
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
