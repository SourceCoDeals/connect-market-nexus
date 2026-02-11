import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Globe2,
  Building2,
  Users,
  Plus,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Upload,
  Database,
  Trophy,
  Handshake,
  Activity,
  Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: number;
}

export function ReMarketingSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Fetch pending submissions count for badge
  const { data: pendingCount } = useQuery({
    queryKey: ["pending-submissions-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("referral_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch un-pushed CapTarget deals count for badge
  const { data: captargetUnpushedCount } = useQuery({
    queryKey: ["captarget-unpushed-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("deal_source", "captarget")
        .eq("pushed_to_all_deals", false);
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/admin/remarketing",
      icon: <LayoutDashboard className="h-5 w-5" />,
      exact: true,
    },
    {
      label: "Buyer Universes",
      href: "/admin/remarketing/universes",
      icon: <Globe2 className="h-5 w-5" />,
    },
    {
      label: "All Deals",
      href: "/admin/remarketing/deals",
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      label: "CapTarget Deals",
      href: "/admin/remarketing/captarget-deals",
      icon: <Crosshair className="h-5 w-5" />,
      badge: captargetUnpushedCount || undefined,
    },
    {
      label: "Referral Partners",
      href: "/admin/remarketing/referral-partners",
      icon: <Handshake className="h-5 w-5" />,
      badge: pendingCount || undefined,
    },
    {
      label: "All Buyers",
      href: "/admin/remarketing/buyers",
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: "Analytics",
      href: "/admin/remarketing/analytics",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      label: "Advanced Analytics",
      href: "/admin/remarketing/analytics/advanced",
      icon: <Trophy className="h-5 w-5" />,
    },
    {
      label: "Activity Queue",
      href: "/admin/remarketing/activity-queue",
      icon: <Activity className="h-5 w-5" />,
    },
    {
      label: "Data Import",
      href: "/admin/remarketing/import",
      icon: <Upload className="h-5 w-5" />,
    },
    {
      label: "Bulk Import",
      href: "/admin/remarketing/bulk-import",
      icon: <Database className="h-5 w-5" />,
    },
  ];

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return location.pathname === item.href;
    }
    return location.pathname.startsWith(item.href);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Globe2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">ReMarketing</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center justify-center h-10 w-full rounded-lg transition-colors relative",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {item.icon}
                      {item.badge && item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                    {item.badge && item.badge > 0 ? ` (${item.badge})` : ""}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold"
                  >
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* New Universe Button */}
        <div className="p-2 border-t border-border">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/admin/remarketing/universes?new=true">
                  <Button variant="outline" size="icon" className="w-full h-10">
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                New Buyer Universe
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link to="/admin/remarketing/universes?new=true">
              <Button variant="outline" className="w-full gap-2">
                <Plus className="h-4 w-4" />
                New Buyer Universe
              </Button>
            </Link>
          )}
        </div>

        {/* Back to Admin Link */}
        <div className="p-2 border-t border-border">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/admin">
                  <Button variant="ghost" size="icon" className="w-full h-10 text-muted-foreground">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                Back to Admin
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link to="/admin">
              <Button variant="ghost" className="w-full gap-2 text-muted-foreground justify-start">
                <ChevronLeft className="h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
