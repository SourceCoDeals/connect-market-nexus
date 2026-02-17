import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Plus,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface MAIntelligenceLayoutProps {
  children?: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/admin/ma-intelligence", icon: LayoutDashboard },
  { name: "Buyer Universes", href: "/admin/ma-intelligence/trackers", icon: Building2 },
  { name: "All Deals", href: "/admin/ma-intelligence/deals", icon: FileText },
  { name: "All Buyers", href: "/admin/ma-intelligence/buyers", icon: Users },
];

export function MAIntelligenceLayout({ children }: MAIntelligenceLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    }).catch(() => {});

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border">
        <Link to="/admin/ma-intelligence" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-sidebar-foreground">M&A Intelligence</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        "lg:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <nav className="flex flex-col h-full p-4">
          {/* Back to Admin Link */}
          <Link
            to="/admin"
            className="flex items-center gap-2 px-3 py-2 mb-4 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent"
            onClick={() => setMobileMenuOpen(false)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>

          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href ||
                (item.href !== "/admin/ma-intelligence" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex fixed top-0 left-0 bottom-0 z-40 flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200",
        sidebarOpen ? "w-64" : "w-20"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
          <Link to="/admin/ma-intelligence" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <span className="text-xl font-bold text-sidebar-foreground">M&A Intel</span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
          >
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        {/* Back to Admin Link */}
        <div className="px-4 pt-4">
          <Link
            to="/admin"
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent",
              !sidebarOpen && "justify-center"
            )}
            title={!sidebarOpen ? "Back to Admin" : undefined}
          >
            <ArrowLeft className="w-4 h-4" />
            {sidebarOpen && "Back to Admin"}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href ||
                (item.href !== "/admin/ma-intelligence" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    !sidebarOpen && "justify-center"
                  )}
                  title={!sidebarOpen ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && item.name}
                </Link>
              );
            })}
          </div>

          {/* Quick Action */}
          {sidebarOpen && (
            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
                asChild
              >
                <Link to="/admin/ma-intelligence/trackers/new">
                  <Plus className="w-4 h-4" />
                  New Buyer Universe
                </Link>
              </Button>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          {user && sidebarOpen && (
            <p className="text-xs text-sidebar-foreground/70 truncate mb-2">
              {user.email}
            </p>
          )}
          <p className={cn(
            "text-xs text-sidebar-foreground/50",
            !sidebarOpen && "text-center"
          )}>
            {sidebarOpen ? "M&A Intelligence Platform" : "M&A"}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn(
        "min-h-screen pt-14 lg:pt-0 transition-all duration-200",
        sidebarOpen ? "lg:pl-64" : "lg:pl-20"
      )}>
        <div className="p-4 lg:p-8">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}

export default MAIntelligenceLayout;
