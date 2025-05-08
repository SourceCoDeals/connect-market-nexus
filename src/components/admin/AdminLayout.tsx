
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

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen">
      {/* Admin sidebar */}
      <AdminNavbar className="w-64 flex-shrink-0" />
      
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
