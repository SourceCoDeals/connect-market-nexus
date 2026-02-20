import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Users,
  Globe2,
  FileText,
  Sparkles,
  ShoppingBag,
  List,
  MessageSquare,
  UserCheck,
  Target,
  Activity,
  Crosshair,
  Briefcase,
  Calculator,
  Handshake,
  BarChart3,
  Settings,
  Bell,
  Database,
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Webhook,
  Brain,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUnviewedDealSourcingCount } from "@/hooks/admin/use-unviewed-deal-sourcing";
import { useUnviewedConnectionRequests } from "@/hooks/admin/use-unviewed-connection-requests";
import { useUnviewedUsers } from "@/hooks/admin/use-unviewed-users";
import { useUnviewedOwnerLeads } from "@/hooks/admin/use-unviewed-owner-leads";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: number;
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  defaultOpen?: boolean;
}

function useNavSections() {
  const { unviewedCount: unviewedDealSourcing } = useUnviewedDealSourcingCount();
  const { unviewedCount: unviewedRequests } = useUnviewedConnectionRequests();
  const { unviewedCount: unviewedUsers } = useUnviewedUsers();
  const { unviewedCount: unviewedOwnerLeads } = useUnviewedOwnerLeads();

  const sections: NavSection[] = [
    {
      id: "deals",
      label: "Deals",
      icon: <Building2 className="h-4 w-4" />,
      items: [
        { label: "All Deals", href: "/admin/deals", icon: <Building2 className="h-4 w-4" /> },
        { label: "Pipeline", href: "/admin/deals/pipeline", icon: <GitBranch className="h-4 w-4" /> },
      ],
    },
    {
      id: "buyers",
      label: "Buyers",
      icon: <Users className="h-4 w-4" />,
      items: [
        { label: "All Buyers", href: "/admin/buyers", icon: <Users className="h-4 w-4" /> },
        { label: "Buyer Universes", href: "/admin/buyers/universes", icon: <Globe2 className="h-4 w-4" /> },
        { label: "Firm Agreements", href: "/admin/buyers/firm-agreements", icon: <FileText className="h-4 w-4" /> },
        {
          label: "Deal Sourcing",
          href: "/admin/buyers/deal-sourcing",
          icon: <Sparkles className="h-4 w-4" />,
          badge: unviewedDealSourcing,
        },
      ],
    },
    {
      id: "marketplace",
      label: "Marketplace",
      icon: <ShoppingBag className="h-4 w-4" />,
      items: [
        { label: "Listings", href: "/admin/marketplace/listings", icon: <List className="h-4 w-4" /> },
        {
          label: "Connection Requests",
          href: "/admin/marketplace/requests",
          icon: <MessageSquare className="h-4 w-4" />,
          badge: unviewedRequests,
        },
        {
          label: "Marketplace Users",
          href: "/admin/marketplace/users",
          icon: <UserCheck className="h-4 w-4" />,
          badge: unviewedUsers,
        },
      ],
    },
    {
      id: "remarketing",
      label: "Remarketing",
      icon: <Target className="h-4 w-4" />,
      items: [
        { label: "Activity Queue", href: "/admin/remarketing/activity-queue", icon: <Activity className="h-4 w-4" /> },
        { label: "CapTarget Deals", href: "/admin/remarketing/leads/captarget", icon: <Crosshair className="h-4 w-4" /> },
        { label: "GP Partner Deals", href: "/admin/remarketing/leads/gp-partners", icon: <Briefcase className="h-4 w-4" /> },
        { label: "Valuation Leads", href: "/admin/remarketing/leads/valuation", icon: <Calculator className="h-4 w-4" /> },
        { label: "Referral Partners", href: "/admin/remarketing/leads/referrals", icon: <Handshake className="h-4 w-4" /> },
      ],
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: <BarChart3 className="h-4 w-4" />,
      items: [
        { label: "Analytics", href: "/admin/analytics", icon: <BarChart3 className="h-4 w-4" /> },
        { label: "Transcript Analytics", href: "/admin/analytics/transcripts", icon: <FileText className="h-4 w-4" /> },
      ],
    },
    {
      id: "admin",
      label: "Admin",
      icon: <Settings className="h-4 w-4" />,
      items: [
        { label: "Internal Team", href: "/admin/settings/team", icon: <Users className="h-4 w-4" /> },
        {
          label: "Owner/Seller Leads",
          href: "/admin/settings/owner-leads",
          icon: <Building2 className="h-4 w-4" />,
          badge: unviewedOwnerLeads,
        },
        { label: "Notifications", href: "/admin/settings/notifications", icon: <Bell className="h-4 w-4" /> },
        { label: "Webhook Settings", href: "/admin/settings/webhooks", icon: <Webhook className="h-4 w-4" /> },
        { label: "Enrichment Test", href: "/admin/settings/enrichment-test", icon: <Sparkles className="h-4 w-4" /> },
        { label: "RM Settings", href: "/admin/settings/remarketing", icon: <Settings className="h-4 w-4" /> },
        { label: "Data Recovery", href: "/admin/settings/data-recovery", icon: <Database className="h-4 w-4" /> },
        { label: "Form Monitoring", href: "/admin/settings/form-monitoring", icon: <ClipboardList className="h-4 w-4" /> },
      ],
    },
  ];

  return sections;
}

export function UnifiedAdminSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const sections = useNavSections();

  const isItemActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.href;
    return location.pathname.startsWith(item.href);
  };

  const isSectionActive = (section: NavSection) =>
    section.items.some((item) => isItemActive(item));

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    // Auto-open the section that contains the current route
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => {
      initial[s.id] = s.items.some((item) => location.pathname.startsWith(item.href));
    });
    return initial;
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card/50 backdrop-blur-sm flex-shrink-0 transition-all duration-300 h-full",
          collapsed ? "w-14" : "w-60"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50 flex-shrink-0">
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-foreground truncate">SourceCo Admin</span>
              <span className="text-xs text-muted-foreground truncate">{user?.first_name || "Admin"}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Dashboard top link */}
        <div className="px-2 pt-2 flex-shrink-0">
          <SidebarLink
            item={{ label: "Dashboard", href: "/admin", icon: <LayoutDashboard className="h-4 w-4" />, exact: true }}
            active={location.pathname === "/admin"}
            collapsed={collapsed}
          />
        </div>

        {/* Scrollable nav sections */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {sections.map((section) => {
            const active = isSectionActive(section);
            const open = openSections[section.id] ?? active;

            if (collapsed) {
              // In collapsed mode, show section icon as a group indicator with tooltip
              return (
                <div key={section.id} className="space-y-0.5">
                  {section.items.map((item) => {
                    const itemActive = isItemActive(item);
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Link
                            to={item.href}
                            className={cn(
                              "flex items-center justify-center h-9 w-full rounded-md transition-colors relative",
                              itemActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {item.icon}
                            {(item.badge ?? 0) > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                                {(item.badge ?? 0) > 9 ? "9+" : item.badge}
                              </span>
                            )}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="flex items-center gap-2">
                          {item.label}
                          {(item.badge ?? 0) > 0 && (
                            <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                              {item.badge}
                            </Badge>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <div className="h-px bg-border/50 my-1" />
                </div>
              );
            }

            return (
              <div key={section.id}>
                {/* Section header — clickable to toggle */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    "flex items-center w-full px-2 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors gap-2",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {section.icon}
                  <span className="flex-1 text-left">{section.label}</span>
                  {open ? (
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  ) : (
                    <ChevronRight className="h-3 w-3 opacity-40" />
                  )}
                </button>

                {/* Section items */}
                {open && (
                  <div className="ml-3 pl-2 border-l border-border/50 space-y-0.5 mt-0.5 mb-1">
                    {section.items.map((item) => (
                      <SidebarLink
                        key={item.href}
                        item={item}
                        active={isItemActive(item)}
                        collapsed={false}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="flex-shrink-0 p-2 border-t border-border/50 space-y-1">
          {/* New Buyer Universe quick action */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/admin/buyers/universes?new=true">
                  <Button variant="outline" size="icon" className="w-full h-8">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">New Buyer Universe</TooltipContent>
            </Tooltip>
          ) : (
            <Link to="/admin/buyers/universes?new=true">
              <Button variant="outline" className="w-full gap-2 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" />
                New Buyer Universe
              </Button>
            </Link>
          )}

          {/* MA Intelligence link */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/admin/ma-intelligence">
                  <Button variant="ghost" size="icon" className="w-full h-8 text-muted-foreground">
                    <Brain className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">M&A Intelligence</TooltipContent>
            </Tooltip>
          ) : (
            <Link to="/admin/ma-intelligence">
              <Button variant="ghost" className="w-full gap-2 h-8 text-xs text-muted-foreground justify-start">
                <Brain className="h-3.5 w-3.5" />
                M&A Intelligence
              </Button>
            </Link>
          )}

          {/* View Marketplace */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/">
                  <Button variant="ghost" size="icon" className="w-full h-8 text-muted-foreground">
                    <ShoppingBag className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">View Marketplace</TooltipContent>
            </Tooltip>
          ) : (
            <Link to="/">
              <Button variant="ghost" className="w-full gap-2 h-8 text-xs text-muted-foreground justify-start">
                <ShoppingBag className="h-3.5 w-3.5" />
                View Marketplace
              </Button>
            </Link>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

interface SidebarLinkProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  compact?: boolean;
}

function SidebarLink({ item, active, collapsed, compact }: SidebarLinkProps) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={item.href}
            className={cn(
              "flex items-center justify-center h-9 w-full rounded-md transition-colors relative",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.icon}
            {(item.badge ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {(item.badge ?? 0) > 9 ? "9+" : item.badge}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      to={item.href}
      className={cn(
        "flex items-center gap-2 rounded-md transition-colors",
        compact ? "px-2 py-1.5 text-xs" : "px-2 py-2 text-sm",
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {item.icon}
      <span className="flex-1 truncate">{item.label}</span>
      {(item.badge ?? 0) > 0 && (
        <Badge
          className={cn(
            "h-4 min-w-[16px] px-1 flex items-center justify-center font-bold",
            active
              ? "bg-primary-foreground/20 text-primary-foreground border-0"
              : "bg-destructive text-destructive-foreground border-0",
            "text-[9px]"
          )}
        >
          {(item.badge ?? 0) > 9 ? "9+" : item.badge}
        </Badge>
      )}
    </Link>
  );
}
