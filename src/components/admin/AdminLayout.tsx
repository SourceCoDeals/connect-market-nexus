import { useState } from "react";
import { Outlet } from "react-router-dom";
import { UnifiedAdminSidebar } from "./UnifiedAdminSidebar";
import { AdminNavbar } from "./AdminNavbar";

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar - hidden on mobile, fixed width on desktop */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 border-r border-border bg-card transition-all duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <UnifiedAdminSidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile nav */}
        <AdminNavbar className="md:hidden" />

        {/* Main content */}
        <main className="flex-1 overflow-auto w-full bg-background/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

