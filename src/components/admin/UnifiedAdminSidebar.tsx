/**
 * UnifiedAdminSidebar.tsx
 *
 * Collapsible navigation sidebar for the admin layout. Renders grouped nav sections
 * (Deals, Buyers, Marketplace, Outreach, Admin) with permission-gated items, unread
 * notification badges, and active-route highlighting.
 *
 * Data sources:
 *   usePermissions for role-based visibility; useUnviewedDealSourcingCount,
 *   useUnviewedConnectionRequests, useUnviewedUsers, useUnviewedOwnerLeads,
 *   useUnreadMessageCounts for badge counts
 *
 * Used on:
 *   AdminLayout wrapper (all /admin/* routes)
 */
import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/permissions/usePermissions';
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Users,
  Globe2,
  Sparkles,
  Store,
  ShoppingBag,
  MessageSquare,
  UserCog,
  Target,
  Crosshair,
  Briefcase,
  Calculator,
  Handshake,
  BarChart3,
  Settings,
  Bell,
  Database,
  ClipboardList,
  FileCheck,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Webhook,
  Brain,
  Wrench,
  FlaskConical,
  ExternalLink,
  Plus,
  List,
  ListChecks,
  Contact,
  Mail,
  Search,
  Phone,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnviewedDealSourcingCount } from '@/hooks/admin/use-unviewed-deal-sourcing';
import { useUnviewedConnectionRequests } from '@/hooks/admin/use-unviewed-connection-requests';
import { useUnviewedUsers } from '@/hooks/admin/use-unviewed-users';
import { useUnviewedOwnerLeads } from '@/hooks/admin/use-unviewed-owner-leads';
import { useUnreadMessageCounts } from '@/hooks/use-connection-messages';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  exact?: boolean;
  external?: boolean;
  separator?: string;
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}

interface AdminSidebarProps {
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onSearchClick?: () => void;
}

export function UnifiedAdminSidebar({
  collapsed,
  onCollapsedChange,
  onSearchClick,
}: AdminSidebarProps) {
  const location = useLocation();
  const { isAdmin: _isFullAdmin, canAccessSettings } = usePermissions();
  const { unviewedCount: unviewedDealSourcingCount } = useUnviewedDealSourcingCount();
  const { unviewedCount: unviewedConnectionRequestsCount } = useUnviewedConnectionRequests();
  const { unviewedCount: unviewedUsersCount } = useUnviewedUsers();
  const { unviewedCount: unviewedOwnerLeadsCount } = useUnviewedOwnerLeads();
  const { data: unreadMessages } = useUnreadMessageCounts();

  const sections: NavSection[] = useMemo(
    () => [
      {
        id: 'deals',
        label: 'Deals',
        icon: <Briefcase className="h-4 w-4" />,
        items: [
          {
            label: 'Active Deals',
            href: '/admin/deals',
            icon: <Building2 className="h-4 w-4" />,
          },
          {
            label: 'Pipeline',
            href: '/admin/deals/pipeline',
            icon: <GitBranch className="h-4 w-4" />,
          },
        ],
      },
      {
        id: 'buyers',
        label: 'Buyers',
        icon: <Users className="h-4 w-4" />,
        items: [
          {
            label: 'All Buyers',
            href: '/admin/buyers',
            icon: <Users className="h-4 w-4" />,
          },
          {
            label: 'Buyer Universes',
            href: '/admin/buyers/universes',
            icon: <Globe2 className="h-4 w-4" />,
          },
          {
            label: 'Deal Sourcing',
            href: '/admin/buyers/deal-sourcing',
            icon: <Sparkles className="h-4 w-4" />,
            badge: unviewedDealSourcingCount,
          },
          {
            label: 'Buyer Contacts',
            href: '/admin/buyers/contacts',
            icon: <Contact className="h-4 w-4" />,
          },
          {
            label: 'Document Tracking',
            href: '/admin/documents',
            icon: <FileCheck className="h-4 w-4" />,
          },
        ],
      },
      {
        id: 'marketplace',
        label: 'Marketplace',
        icon: <Store className="h-4 w-4" />,
        items: [
          {
            label: 'View Marketplace',
            href: '/',
            icon: <ShoppingBag className="h-4 w-4" />,
            external: true,
          },
          {
            label: 'Marketplace Queue',
            href: '/admin/marketplace/queue',
            icon: <ClipboardList className="h-4 w-4" />,
          },
          {
            label: 'Connection Requests',
            href: '/admin/marketplace/requests',
            icon: <MessageSquare className="h-4 w-4" />,
            badge: unviewedConnectionRequestsCount,
          },
          {
            label: 'Marketplace Users',
            href: '/admin/marketplace/users',
            icon: <UserCog className="h-4 w-4" />,
            badge: unviewedUsersCount,
          },
        ],
      },
      {
        id: 'remarketing',
        label: 'Remarketing',
        icon: <Target className="h-4 w-4" />,
        items: [
          {
            label: 'Overview',
            href: '/admin/remarketing',
            icon: <LayoutDashboard className="h-4 w-4" />,
            exact: true,
          },
          {
            label: 'CapTarget Deals',
            href: '/admin/remarketing/leads/captarget',
            icon: <Crosshair className="h-4 w-4" />,
            separator: 'Lead Sources',
          },
          {
            label: 'GP Partner Deals',
            href: '/admin/remarketing/leads/gp-partners',
            icon: <Briefcase className="h-4 w-4" />,
          },
          {
            label: 'Valuation Leads',
            href: '/admin/remarketing/leads/valuation',
            icon: <Calculator className="h-4 w-4" />,
          },
          {
            label: 'Referral Partners',
            href: '/admin/remarketing/leads/referrals',
            icon: <Handshake className="h-4 w-4" />,
          },
          {
            label: 'Owner/Seller Leads',
            href: '/admin/settings/owner-leads',
            icon: <ClipboardList className="h-4 w-4" />,
            badge: unviewedOwnerLeadsCount,
          },
        ],
      },
      {
        id: 'lists',
        label: 'Lists',
        icon: <List className="h-4 w-4" />,
        items: [
          {
            label: 'Lists',
            href: '/admin/lists',
            icon: <ListChecks className="h-4 w-4" />,
          },
        ],
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: <BarChart3 className="h-4 w-4" />,
        items: [
          {
            label: 'Analytics',
            href: '/admin/analytics',
            icon: <BarChart3 className="h-4 w-4" />,
          },
          {
            label: 'Transcript Analytics',
            href: '/admin/analytics/transcripts',
            icon: <ClipboardList className="h-4 w-4" />,
          },
        ],
      },
      {
        id: 'admin',
        label: 'Admin',
        icon: <Settings className="h-4 w-4" />,
        items: [
          {
            label: 'Internal Team',
            href: '/admin/settings/team',
            icon: <UserCog className="h-4 w-4" />,
          },
          {
            label: 'Notifications',
            href: '/admin/settings/notifications',
            icon: <Bell className="h-4 w-4" />,
          },
          // Settings pages hidden from team members (moderator role)
          ...(canAccessSettings
            ? [
                {
                  label: 'Smartlead Campaigns',
                  href: '/admin/smartlead/campaigns',
                  icon: <Mail className="h-4 w-4" />,
                  separator: 'Smartlead',
                },
                {
                  label: 'Smartlead Settings',
                  href: '/admin/smartlead/settings',
                  icon: <Settings className="h-4 w-4" />,
                },
                {
                  label: 'Dial Sessions',
                  href: '/admin/phoneburner/sessions',
                  icon: <Phone className="h-4 w-4" />,
                  separator: 'PhoneBurner',
                },
                {
                  label: 'PhoneBurner Settings',
                  href: '/admin/phoneburner/settings',
                  icon: <Settings className="h-4 w-4" />,
                },
                {
                  label: 'Fireflies',
                  href: '/admin/fireflies',
                  icon: <Phone className="h-4 w-4" />,
                  separator: 'Fireflies',
                },
                {
                  label: 'Webhook Settings',
                  href: '/admin/settings/webhooks',
                  icon: <Webhook className="h-4 w-4" />,
                  separator: 'Settings',
                },
                {
                  label: 'Enrichment Queue',
                  href: '/admin/settings/enrichment-queue',
                  icon: <ListChecks className="h-4 w-4" />,
                },
                {
                  label: 'ReMarketing Settings',
                  href: '/admin/settings/remarketing',
                  icon: <Wrench className="h-4 w-4" />,
                },
                {
                  label: 'Data Recovery',
                  href: '/admin/settings/data-recovery',
                  icon: <Database className="h-4 w-4" />,
                },
              ]
            : []),
          {
            label: 'Form Monitoring',
            href: '/admin/settings/form-monitoring',
            icon: <FileCheck className="h-4 w-4" />,
          },
          {
            label: 'Security & MFA',
            href: '/admin/settings/security',
            icon: <ShieldCheck className="h-4 w-4" />,
          },
          {
            label: 'Testing & Diagnostics',
            href: '/admin/testing',
            icon: <FlaskConical className="h-4 w-4" />,
          },
        ],
      },
    ],
    [
      unviewedDealSourcingCount,
      unviewedConnectionRequestsCount,
      unviewedUsersCount,
      unviewedOwnerLeadsCount,
      canAccessSettings,
    ],
  );

  const activeSectionId = useMemo(() => {
    for (const section of sections) {
      for (const item of section.items) {
        if (item.external) continue;
        if (item.exact && location.pathname === item.href) return section.id;
        if (!item.exact && location.pathname.startsWith(item.href)) return section.id;
      }
    }
    return null;
  }, [location.pathname, sections]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeSectionId) initial.add(activeSectionId);
    return initial;
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const isItemActive = (item: NavItem) => {
    if (item.external) return false;
    if (item.exact) return location.pathname === item.href;
    return location.pathname.startsWith(item.href);
  };

  const sectionHasBadge = (section: NavSection) =>
    section.items.some((item) => item.badge && item.badge > 0);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-full">
        {/* Collapse toggle */}
        <div className="flex items-center justify-end px-2 pt-2 pb-1">
          <button
            onClick={() => onCollapsedChange?.(!collapsed)}
            className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Universal Search */}
        <div className="px-3 pb-1">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSearchClick}
                  className="flex items-center justify-center w-full h-9 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Search className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Search (⌘K)</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={onSearchClick}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left truncate">Search</span>
              <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          )}
        </div>

        {/* Dashboard + Messages - standalone top items */}
        <div className="px-3 pb-1 space-y-0.5">
          <SidebarLink
            href="/admin"
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Dashboard"
            isActive={location.pathname === '/admin' || location.pathname === '/admin/dashboard'}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/admin/marketplace/messages"
            icon={<Mail className="h-4 w-4" />}
            label="Messages"
            isActive={location.pathname === '/admin/marketplace/messages'}
            collapsed={collapsed}
            badge={unreadMessages?.total || 0}
          />
          <SidebarLink
            href="/admin/daily-tasks"
            icon={<ListChecks className="h-4 w-4" />}
            label="Daily Tasks"
            isActive={location.pathname.startsWith('/admin/daily-tasks')}
            collapsed={collapsed}
          />
        </div>

        {/* Scrollable sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
          {sections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const isActive = activeSectionId === section.id;
            const hasBadge = sectionHasBadge(section);

            if (collapsed) {
              return (
                <Tooltip key={section.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        'flex items-center justify-center w-full h-9 rounded-md transition-colors relative',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {section.icon}
                      {hasBadge && (
                        <div className="absolute top-0.5 right-1 h-2 w-2 bg-notification rounded-full" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {section.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'flex items-center w-full px-2 py-1.5 text-sm font-semibold uppercase tracking-wider rounded-md transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground/70 hover:text-muted-foreground',
                  )}
                >
                  <span className="mr-2">{section.icon}</span>
                  <span className="flex-1 text-left">{section.label}</span>
                  {hasBadge && !isExpanded && (
                    <div className="h-2 w-2 bg-notification rounded-full mr-1" />
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-2 space-y-0.5 mt-0.5 mb-1">
                    {section.items.map((item) => (
                      <div key={item.href}>
                        {item.separator && (
                          <div className="px-2 pt-2 pb-1">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                              {item.separator}
                            </span>
                          </div>
                        )}
                        <SidebarLink
                          href={item.href}
                          icon={item.icon}
                          label={item.label}
                          isActive={isItemActive(item)}
                          collapsed={false}
                          badge={item.badge}
                          external={item.external}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* New Buyer Universe quick action */}
        {!collapsed && (
          <div className="px-3 py-2 border-t border-border/50">
            <Link to="/admin/buyers/universes?new=true">
              <Button variant="outline" className="w-full gap-2 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" />
                New Buyer Universe
              </Button>
            </Link>
          </div>
        )}
        {collapsed && (
          <div className="px-3 py-2 border-t border-border/50">
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
          </div>
        )}

        {/* Bottom links */}
        {!collapsed && (
          <div className="px-3 py-2 border-t border-border/50 space-y-0.5">
            <SidebarLink
              href="/admin/ma-intelligence"
              icon={<Brain className="h-4 w-4" />}
              label="MA Intelligence"
              isActive={location.pathname.startsWith('/admin/ma-intelligence')}
              collapsed={false}
              external
            />
          </div>
        )}
        {collapsed && (
          <div className="px-3 py-2 border-t border-border/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/admin/ma-intelligence"
                  className="flex items-center justify-center h-9 w-full rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Brain className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">MA Intelligence</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  collapsed: boolean;
  badge?: number;
  external?: boolean;
}

function SidebarLink({
  href,
  icon,
  label,
  isActive,
  collapsed,
  badge,
  external,
}: SidebarLinkProps) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={href}
            className={cn(
              'flex items-center justify-center h-9 rounded-md transition-colors relative',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {icon}
            {badge != null && badge > 0 && (
              <div className="absolute top-0.5 right-1 h-2 w-2 bg-notification rounded-full" />
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          {label}
          {badge != null && badge > 0 ? ` (${badge})` : ''}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      to={href}
      className={cn(
        'flex items-center gap-2.5 px-2 py-1.5 text-sm rounded-md transition-colors group',
        isActive
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {external && <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />}
      {badge != null && badge > 0 && (
        <Badge
          className={cn(
            'h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold shrink-0',
            isActive
              ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30'
              : 'bg-notification text-notification-foreground border-notification',
          )}
        >
          {badge > 9 ? '9+' : badge}
        </Badge>
      )}
    </Link>
  );
}
