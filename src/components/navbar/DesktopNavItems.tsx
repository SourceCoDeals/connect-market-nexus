
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Store, Briefcase, Heart, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserNotifications } from "@/hooks/use-user-notifications";

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

  return (
    <div className="flex items-center space-x-6">
      <Link
        to="/"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
          location.pathname === "/" 
            ? "text-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Store className="h-4 w-4" />
        Marketplace
      </Link>
      
      <Link
        to="/saved-listings"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
          location.pathname === "/saved-listings" 
            ? "text-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Heart className="h-4 w-4" />
        Saved Listings
      </Link>

      <Link
        to="/my-requests"
        className={cn(
          "relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
          location.pathname === "/my-requests" 
            ? "text-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Briefcase className="h-4 w-4" strokeWidth={1.5} />
        My Deals
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </Link>

      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={onNavigateToAdmin}
          className="flex items-center gap-2"
        >
          <Shield className="h-4 w-4" />
          Admin Dashboard
        </Button>
      )}
    </div>
  );
};

export default DesktopNavItems;
