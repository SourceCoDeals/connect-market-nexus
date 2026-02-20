import { Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminNavbar } from "./AdminNavbar";
import { AdminSidebar } from "./AdminSidebar";
import { useState } from "react";
import { GlobalActivityStatusBar } from "@/components/remarketing/GlobalActivityStatusBar";
import { ActivityCompletionDialog } from "@/components/remarketing/ActivityCompletionDialog";

const AdminLayout = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Unified admin sidebar */}
      <aside
        className={cn(
          "bg-card/50 backdrop-blur-sm border-r border-border/50 flex-shrink-0 transition-all duration-300 ease-in-out hidden md:flex flex-col",
          "hover:shadow-lg",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
        onMouseEnter={() => setSidebarCollapsed(false)}
        onMouseLeave={() => setSidebarCollapsed(true)}
      >
        {/* Header */}
        <div className="p-4 pb-0">
          <div
            className={cn(
              "mb-2 transition-all duration-300",
              sidebarCollapsed && "opacity-0 scale-95"
            )}
          >
            {!sidebarCollapsed && (
              <>
                <h2 className="text-lg font-bold mb-0.5 bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  SourceCo
                </h2>
                <p className="text-xs text-muted-foreground">
                  {user?.first_name || "Admin"}
                </p>
              </>
            )}
          </div>

          {sidebarCollapsed && (
            <div className="mb-2 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 hover:bg-primary/10"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar navigation */}
        <div className="flex-1 overflow-hidden">
          <AdminSidebar collapsed={sidebarCollapsed} />
        </div>
      </aside>

      <div className="flex flex-col flex-1">
        {/* Mobile nav */}
        <AdminNavbar className="md:hidden" />

        {/* Global activity status bar - visible on all admin pages */}
        <GlobalActivityStatusBar />
        <ActivityCompletionDialog />

        {/* Main content */}
        <main className="flex-1 overflow-auto w-full min-w-0 bg-background/50">
          <div className="max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
