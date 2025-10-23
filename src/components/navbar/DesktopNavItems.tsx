
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { MarketplaceIcon, SavedIcon, DealsIcon, AdminIcon } from "@/components/icons/NavIcons";

interface DesktopNavItemsProps {
  isAdmin: boolean;
  isApproved: boolean;
  onNavigateToAdmin: () => void;
}

const DesktopNavItems = ({ isAdmin, isApproved, onNavigateToAdmin }: DesktopNavItemsProps) => {
  const location = useLocation();
  const { unreadCount } = useUserNotifications();

  if (!isApproved) {
    return null;
  }

  const navItems = [
    {
      to: "/",
      label: "Marketplace",
      icon: MarketplaceIcon,
      isActive: location.pathname === "/",
    },
    {
      to: "/saved-listings",
      label: "Saved",
      icon: SavedIcon,
      isActive: location.pathname === "/saved-listings",
    },
    {
      to: "/my-requests",
      label: "My Deals",
      icon: DealsIcon,
      isActive: location.pathname === "/my-requests",
      badge: unreadCount,
    },
  ];

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "relative inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200",
              item.isActive
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            <Icon className={cn(
              "w-4 h-4 transition-colors",
              item.isActive ? "text-slate-700" : "text-slate-500"
            )} />
            {item.label}
            {item.badge && item.badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-semibold text-white ring-2 ring-white shadow-sm">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </Link>
        );
      })}

      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={onNavigateToAdmin}
          className="ml-2 h-8 gap-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
        >
          <AdminIcon className="w-4 h-4" />
          Admin
        </Button>
      )}
    </nav>
  );
};

export default DesktopNavItems;
