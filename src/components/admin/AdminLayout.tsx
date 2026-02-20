import { Outlet } from "react-router-dom";
import { UnifiedAdminSidebar } from "./UnifiedAdminSidebar";
import { AdminNavbar } from "./AdminNavbar";

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Unified sidebar - hidden on mobile */}
      <div className="hidden md:flex flex-shrink-0 h-screen sticky top-0">
        <UnifiedAdminSidebar />
      </div>

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
