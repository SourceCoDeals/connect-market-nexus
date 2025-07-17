
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Store, User, MessageSquare, Heart, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface DesktopNavItemsProps {
  isAdmin: boolean;
  isApproved: boolean;
  onNavigateToAdmin: () => void;
}

const DesktopNavItems = ({ isAdmin, isApproved, onNavigateToAdmin }: DesktopNavItemsProps) => {
  const location = useLocation();

  if (!isApproved) {
    return null;
  }

  return (
    <div className="flex items-center space-x-4">
      <Link
        to="/"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
          location.pathname === "/" 
            ? "bg-primary text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <Store className="h-4 w-4" />
        Marketplace
      </Link>
      
      <Link
        to="/my-requests"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
          location.pathname === "/my-requests" 
            ? "bg-primary text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <MessageSquare className="h-4 w-4" />
        My Requests
      </Link>

      <Link
        to="/saved-listings"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
          location.pathname === "/saved-listings" 
            ? "bg-primary text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <Heart className="h-4 w-4" />
        Saved
      </Link>

      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={onNavigateToAdmin}
          className="flex items-center gap-2"
        >
          <Shield className="h-4 w-4" />
          Admin
        </Button>
      )}
    </div>
  );
};

export default DesktopNavItems;
